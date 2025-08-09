/**
 * ChangeStreamManager.js
 * Service for managing MongoDB change streams with robust error handling and reconnection logic.
 */
const mongoose = require('mongoose');
const { dbService } = require('../config/database');
const EventEmitter = require('events');

class ChangeStreamManager extends EventEmitter {
  /**
   * Create a new ChangeStreamManager instance
   * @param {Object} options - Configuration options
   * @param {Array<string>} options.collections - Collections to watch
   * @param {number} options.maxRetries - Maximum number of retry attempts
   * @param {number} options.initialDelayMs - Initial delay for retry in milliseconds
   * @param {number} options.maxDelayMs - Maximum delay for retry in milliseconds
   */
  constructor(options = {}) {
    super();
    this.collections = options.collections || ['messages', 'reports', 'notices'];
    this.maxRetries = options.maxRetries || 10;
    this.initialDelayMs = options.initialDelayMs || 1000;
    this.maxDelayMs = options.maxDelayMs || 60000;
    this.streams = new Map();
    this.resumeTokens = new Map();
    this.listeners = new Map();
    this.isConnected = false;
    this.reconnectAttempts = new Map();
  }

  /**
   * Initialize change streams for all configured collections
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      // Ensure database is connected
      if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        await dbService.connect();
      }
      
      this.isConnected = true;
      
      // Start watching all collections
      for (const collection of this.collections) {
        await this.watchCollection(collection);
      }
      
      console.log(`Change streams initialized for collections: ${this.collections.join(', ')}`);
      this.emit('initialized', { collections: this.collections });
    } catch (error) {
      console.error('Failed to initialize change streams:', error);
      this.emit('error', { reason: 'initialization_failed', error });
      throw error;
    }
  }

  /**
   * Watch a specific collection for changes
   * @param {string} collectionName - Name of the collection to watch
   * @returns {Promise<void>}
   */
  async watchCollection(collectionName) {
    try {
      // Close existing stream if any
      if (this.streams.has(collectionName)) {
        await this.closeStream(collectionName);
      }
      
      // Reset reconnect attempts for this collection
      this.reconnectAttempts.set(collectionName, 0);
      
      // Get the collection
      const collection = mongoose.connection.db.collection(collectionName);
      
      // Create pipeline for the change stream
      const pipeline = [
        {
          $match: {
            operationType: { $in: ['insert', 'update', 'delete', 'replace'] }
          }
        }
      ];
      
      // Options for the change stream
      const options = {
        // Change streams require 'majority' read concern
        readConcern: { level: 'majority' }
      };
      
      // Add resume token if available
      if (this.resumeTokens.has(collectionName)) {
        options.resumeAfter = this.resumeTokens.get(collectionName);
      }
      
      // Create the change stream
      const changeStream = collection.watch(pipeline, options);
      
      // Store the stream
      this.streams.set(collectionName, changeStream);
      
      // Set up event handlers
      changeStream.on('change', (change) => this.handleChange(collectionName, change));
      
      changeStream.on('error', (error) => this.handleError(collectionName, error));
      
      changeStream.on('close', () => {
        console.log(`Change stream for ${collectionName} closed`);
        this.emit('stream_closed', { collection: collectionName });
      });
      
      changeStream.on('end', () => {
        console.log(`Change stream for ${collectionName} ended`);
        this.emit('stream_ended', { collection: collectionName });
        
        // Try to reconnect if not explicitly closed
        if (this.isConnected) {
          this.reconnectStream(collectionName);
        }
      });
      
      console.log(`Change stream established for collection: ${collectionName}`);
      this.emit('stream_opened', { collection: collectionName });
      
    } catch (error) {
      console.error(`Failed to watch collection ${collectionName}:`, error);
      this.emit('error', { reason: 'watch_failed', collection: collectionName, error });
      
      // Try to reconnect
      this.reconnectStream(collectionName);
    }
  }

  /**
   * Handle a change event from a change stream
   * @param {string} collectionName - Name of the collection
   * @param {Object} change - Change event data
   * @private
   */
  handleChange(collectionName, change) {
    try {
      // Store resume token for reconnection
      if (change._id) {
        this.resumeTokens.set(collectionName, change._id);
      }
      
      // Emit the change event
      this.emit('change', { collection: collectionName, change });
      
      // Emit collection-specific event
      this.emit(`${collectionName}_change`, change);
      
      // Call registered listeners for this collection
      if (this.listeners.has(collectionName)) {
        for (const listener of this.listeners.get(collectionName)) {
          try {
            listener(change);
          } catch (listenerError) {
            console.error(`Error in change listener for ${collectionName}:`, listenerError);
          }
        }
      }
    } catch (error) {
      console.error(`Error handling change for ${collectionName}:`, error);
      this.emit('error', { reason: 'handle_change_failed', collection: collectionName, error });
    }
  }

  /**
   * Handle an error from a change stream
   * @param {string} collectionName - Name of the collection
   * @param {Error} error - The error that occurred
   * @private
   */
  handleError(collectionName, error) {
    console.error(`Change stream error for ${collectionName}:`, error);
    this.emit('stream_error', { collection: collectionName, error });
    
    // Try to reconnect
    this.reconnectStream(collectionName);
  }

  /**
   * Attempt to reconnect a change stream with exponential backoff
   * @param {string} collectionName - Name of the collection
   * @private
   */
  async reconnectStream(collectionName) {
    try {
      // Get current attempt count
      const attempts = this.reconnectAttempts.get(collectionName) || 0;
      
      // Check if max retries exceeded
      if (attempts >= this.maxRetries) {
        console.error(`Max reconnection attempts (${this.maxRetries}) reached for ${collectionName}`);
        this.emit('max_retries_exceeded', { collection: collectionName, attempts });
        return;
      }
      
      // Increment attempt counter
      this.reconnectAttempts.set(collectionName, attempts + 1);
      
      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(this.initialDelayMs * Math.pow(2, attempts), this.maxDelayMs);
      const jitteredDelay = delay + (Math.random() * delay * 0.2);
      
      console.log(`Reconnecting to ${collectionName} change stream in ${Math.round(jitteredDelay)}ms (attempt ${attempts + 1}/${this.maxRetries})`);
      this.emit('reconnecting', { collection: collectionName, attempt: attempts + 1, delay: jitteredDelay });
      
      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, jitteredDelay));
      
      // Attempt to reconnect
      await this.watchCollection(collectionName);
      
    } catch (error) {
      console.error(`Error reconnecting to ${collectionName} change stream:`, error);
      this.emit('reconnect_error', { collection: collectionName, error });
      
      // Try again if not at max retries
      const attempts = this.reconnectAttempts.get(collectionName) || 0;
      if (attempts < this.maxRetries) {
        this.reconnectStream(collectionName);
      }
    }
  }

  /**
   * Close a specific change stream
   * @param {string} collectionName - Name of the collection
   * @returns {Promise<void>}
   */
  async closeStream(collectionName) {
    try {
      const stream = this.streams.get(collectionName);
      if (stream) {
        await stream.close();
        this.streams.delete(collectionName);
        console.log(`Closed change stream for ${collectionName}`);
      }
    } catch (error) {
      console.error(`Error closing change stream for ${collectionName}:`, error);
    }
  }

  /**
   * Add a listener for a specific collection's changes
   * @param {string} collectionName - Name of the collection
   * @param {Function} listener - Callback function for changes
   */
  addListener(collectionName, listener) {
    if (!this.listeners.has(collectionName)) {
      this.listeners.set(collectionName, new Set());
    }
    this.listeners.get(collectionName).add(listener);
  }

  /**
   * Remove a listener for a specific collection's changes
   * @param {string} collectionName - Name of the collection
   * @param {Function} listener - Callback function to remove
   */
  removeListener(collectionName, listener) {
    if (this.listeners.has(collectionName)) {
      this.listeners.get(collectionName).delete(listener);
    }
  }

  /**
   * Close all change streams and clean up
   * @returns {Promise<void>}
   */
  async close() {
    try {
      this.isConnected = false;
      
      // Close all streams
      for (const collectionName of this.streams.keys()) {
        await this.closeStream(collectionName);
      }
      
      // Clear maps
      this.streams.clear();
      this.listeners.clear();
      
      console.log('All change streams closed');
      this.emit('closed');
    } catch (error) {
      console.error('Error closing change streams:', error);
      this.emit('error', { reason: 'close_failed', error });
    }
  }

  /**
   * Get status information about all change streams
   * @returns {Object} Status information
   */
  getStatus() {
    const status = {
      isConnected: this.isConnected,
      collections: {},
      activeStreams: 0,
      totalListeners: 0
    };
    
    for (const collectionName of this.collections) {
      const hasStream = this.streams.has(collectionName);
      const listenerCount = this.listeners.has(collectionName) ? this.listeners.get(collectionName).size : 0;
      const attempts = this.reconnectAttempts.get(collectionName) || 0;
      
      status.collections[collectionName] = {
        active: hasStream,
        listeners: listenerCount,
        reconnectAttempts: attempts,
        hasResumeToken: this.resumeTokens.has(collectionName)
      };
      
      if (hasStream) {
        status.activeStreams++;
      }
      
      status.totalListeners += listenerCount;
    }
    
    return status;
  }
}

module.exports = ChangeStreamManager;