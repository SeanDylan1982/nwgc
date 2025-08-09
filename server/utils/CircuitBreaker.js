/**
 * CircuitBreaker.js
 * Implementation of the Circuit Breaker pattern to prevent cascading failures.
 */
const EventEmitter = require('events');

// Circuit states
const STATES = {
  CLOSED: 'CLOSED',     // Normal operation, requests pass through
  OPEN: 'OPEN',         // Failure threshold exceeded, requests fail fast
  HALF_OPEN: 'HALF_OPEN' // Testing if service has recovered
};

class CircuitBreaker extends EventEmitter {
  /**
   * Create a new CircuitBreaker instance
   * @param {Object} options - Configuration options
   * @param {number} options.failureThreshold - Number of failures before opening circuit
   * @param {number} options.resetTimeout - Time in ms before attempting reset (half-open)
   * @param {number} options.halfOpenSuccessThreshold - Successes needed in half-open before closing
   * @param {Function} options.fallbackFunction - Function to call when circuit is open
   */
  constructor(options = {}) {
    super();
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold || 2;
    this.fallbackFunction = options.fallbackFunction;
    
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    this.lastStateChange = Date.now();
    
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      stateHistory: [{
        state: this.state,
        timestamp: this.lastStateChange
      }]
    };
  }

  /**
   * Execute a function with circuit breaker protection
   * @param {Function} func - The function to execute
   * @param {Array} args - Arguments to pass to the function
   * @returns {Promise<any>} - Result of the function or fallback
   */
  async execute(func, ...args) {
    this.metrics.totalCalls++;
    
    if (this.state === STATES.OPEN) {
      // Check if it's time to try again
      if (Date.now() > this.nextAttempt) {
        this._transitionTo(STATES.HALF_OPEN);
      } else {
        this.metrics.rejectedCalls++;
        this.emit('rejected', { state: this.state });
        
        // If fallback function is provided, use it
        if (this.fallbackFunction) {
          return this.fallbackFunction(...args);
        }
        
        throw new Error(`Circuit breaker is open - service unavailable`);
      }
    }
    
    try {
      const result = await func(...args);
      this._handleSuccess();
      return result;
    } catch (error) {
      this._handleFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   * @private
   */
  _handleSuccess() {
    this.metrics.successfulCalls++;
    this.metrics.lastSuccessTime = Date.now();
    
    if (this.state === STATES.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this._transitionTo(STATES.CLOSED);
      }
    }
    
    // Reset failure count in closed state
    if (this.state === STATES.CLOSED) {
      this.failureCount = 0;
    }
    
    this.emit('success', { state: this.state });
  }

  /**
   * Handle execution failure
   * @param {Error} error - The error that occurred
   * @private
   */
  _handleFailure(error) {
    this.failureCount++;
    this.metrics.failedCalls++;
    this.metrics.lastFailureTime = Date.now();
    
    if (this.state === STATES.CLOSED && this.failureCount >= this.failureThreshold) {
      this._transitionTo(STATES.OPEN);
    }
    
    if (this.state === STATES.HALF_OPEN) {
      this._transitionTo(STATES.OPEN);
    }
    
    this.emit('failure', { state: this.state, error });
  }

  /**
   * Transition to a new state
   * @param {string} newState - The new state
   * @private
   */
  _transitionTo(newState) {
    const previousState = this.state;
    const timestamp = Date.now();
    
    this.state = newState;
    this.lastStateChange = timestamp;
    
    // Reset counters
    if (newState === STATES.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
    } else if (newState === STATES.OPEN) {
      this.successCount = 0;
      this.nextAttempt = Date.now() + this.resetTimeout;
    } else if (newState === STATES.HALF_OPEN) {
      this.successCount = 0;
    }
    
    // Update state history
    this.metrics.stateHistory.push({
      from: previousState,
      to: newState,
      timestamp
    });
    
    // Trim history if needed
    if (this.metrics.stateHistory.length > 50) {
      this.metrics.stateHistory.shift();
    }
    
    this.emit('state_change', {
      from: previousState,
      to: newState,
      timestamp
    });
  }

  /**
   * Force the circuit into a specific state
   * @param {string} state - The state to force
   * @returns {CircuitBreaker} this instance for chaining
   */
  forceState(state) {
    if (Object.values(STATES).includes(state)) {
      this._transitionTo(state);
    } else {
      throw new Error(`Invalid circuit state: ${state}`);
    }
    return this;
  }

  /**
   * Reset the circuit breaker to closed state
   * @returns {CircuitBreaker} this instance for chaining
   */
  reset() {
    this._transitionTo(STATES.CLOSED);
    return this;
  }

  /**
   * Get the current state of the circuit
   * @returns {string} Current state
   */
  getState() {
    return this.state;
  }

  /**
   * Get circuit breaker metrics
   * @returns {Object} Metrics
   */
  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastStateChange: this.lastStateChange,
      nextAttempt: this.nextAttempt,
      ...this.metrics
    };
  }
}

// Export the class and states
module.exports = CircuitBreaker;
module.exports.STATES = STATES;