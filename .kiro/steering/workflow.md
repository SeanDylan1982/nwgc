<!------------------------------------------------------------------------------------
   Add Rules to this file or a short description and have Kiro refine them for you:  
-------------------------------------------------------------------------------------> 

AI Coding Agent Workflow Plan
Phase 1: Information Gathering and Planning
Objective 1: Application Requirements Collection
Task: Request detailed application specifications from Code Instructor

Actions:

 Ask Code Instructor for comprehensive app description
 Request the primary goal and purpose of the proposed application
 Inquire about conceptual stage details and product vision
 Gather any existing wireframes, mockups, or design concepts
 Clarify target audience and user personas
 Determine performance requirements and scalability needs
 Identify any compliance or security requirements
Expected Response Format:


Please provide:
1. Detailed description of the application to be built
2. Primary goals and objectives of the application
3. Conceptual stage details and product development vision
4. Any additional context that would help guide development
Objective 2: Environment Configuration and Security Setup
Task: Collect all required secrets, keys, and configuration details

Actions:

 Request all necessary API keys and secrets
 Obtain MongoDB Atlas connection string
 Gather any third-party service credentials
 Determine frontend and backend port allocations
 Identify any environment-specific configurations
 Confirm security requirements for sensitive data handling
 Document all .env file requirements
Expected Response Format:


Please provide:
1. MongoDB Atlas connection string
2. All API keys and secret credentials
3. Port numbers for frontend and backend servers
4. Any additional environment variables needed
5. Security and access control requirements
Objective 3: Detailed Project Planning and Documentation
3.1: Generate Comprehensive plan.md Document
Task: Create detailed step-by-step project plan

Actions:

 Create plan.md with structured format
 Include project overview and objectives
 Break down development into phases
 List all major features and components
 Add detailed sub-tasks for each feature
 Include timeline estimates and dependencies
 Add check blocks for task tracking
 Incorporate error handling and recovery procedures
 Include testing requirements for each component
plan.md Structure:


# Project Development Plan

## Project Overview
[Brief description of the application]

## Objectives
[List of primary and secondary objectives]

## Phase 1: Project Setup
- [ ] Task 1.1: Initialize project structure
- [ ] Task 1.2: Configure development environment
- [ ] Task 1.3: Set up version control
- [ ] Task 1.4: Install dependencies

## Phase 2: Core Architecture
- [ ] Task 2.1: Design database schema
- [ ] Task 2.2: Create API architecture
- [ ] Task 2.3: Implement authentication system
- [ ] Task 2.4: Set up middleware components

[Continue with additional phases...]

## Testing Requirements
[List of testing protocols for each phase]

## Deployment Plan
[Steps for production deployment]

## Risk Mitigation
[Block handling procedures and recovery plans]
3.2: Plan Review and Customization
Task: Get Code Instructor feedback on the generated plan

Actions:

 Present completed plan.md to Code Instructor
 Request any special instructions or preferences
 Inquire about specific deviations or modifications needed
 Incorporate feedback into the plan
 Get final approval on the development approach
Expected Response Format:


Please review the attached plan.md and provide:
1. Any special instructions or preferences
2. Specific deviations you want incorporated
3. Additional requirements not covered in the plan
4. Approval to proceed with this development approach
3.3: Planning Phase Summary
Task: Document all planning activities and establish recovery protocols

Actions:

 Summarize all objectives and their completion status
 Document the approved development plan
 Outline the failsafe mechanisms for recovery
 Establish block handling procedures
 Create checkpoint system for progress tracking
 Define communication protocols with Code Instructor

Phase 2: Implementation and Development
Development Workflow Protocol
Daily Development Cycle:
Morning Review:
 Check plan.md for today's tasks
 Review any blockers from previous day
 Confirm environment readiness
Task Execution:
 Select next unchecked task from plan.md
 Implement minimal viable solution
 Add comprehensive comments
 Write corresponding unit tests
 Verify functionality
 Update documentation
Evening Summary:
 Check off completed tasks in plan.md
 Document any deviations or issues
 Plan next day's activities
 Backup current progress
Block Handling Protocol:
Block Detection:
 Monitor for 3 consecutive failed attempts
 Document the nature of the block
 Tag the blocked task in plan.md
Recovery Process:
 Generate comprehensive project summary
 Update plan.md with block details
 Continue with unblocked tasks
 Attempt alternative approaches
Escalation Protocol:
 If block persists > 24 hours
 Request Code Instructor intervention
 Provide detailed block analysis
 Suggest alternative approaches

MCP Servers Integration and Usage
Available MCP Servers and Functions:
1. Fetch Server

Function: Fetch a URL and extract contents as markdown
Usage: Research documentation, gather external resources, extract content for analysis
Implementation: fetch(url) → returns markdown content
2. Memory Server

Functions:
create_entities(): Create new entities in knowledge graph
create_relations(): Establish relationships between entities
add_observations(): Add observations about entities/relations
delete_entities(): Remove entities from knowledge graph
delete_observations(): Remove observations
delete_relations(): Remove relationships
read_graph(): Read entire knowledge graph
search_nodes(): Search for specific nodes
open_nodes(): Access detailed node information
Usage: Track project knowledge, maintain context, store learned information
3. File System Server

Functions: Various file system operations
Usage: File creation, modification, deletion, directory management
Implementation: Search MCP documentation for detailed usage instructions
4. Usehooks Server

Functions: Various hook-related operations
Usage: React hooks management, custom hook creation
Implementation: Search MCP documentation for detailed usage instructions
5. Build-my-own Server

Function: Clones a GitHub repo for customization
Usage: Start with existing templates or boilerplates
Implementation: build_my_own(repo_url) → clones and prepares for customization
6. Concurrent-browser-mcp Server

Functions: Multiple browser-related operations
Usage: Parallel browser operations, multi-tab management
Implementation: Search MCP documentation for detailed usage instructions
7. Octocode Server

Functions: Various coding assistance operations
Usage: Code generation, refactoring, optimization
Implementation: Search MCP documentation for detailed usage instructions
8. Message-mcp Server

Functions: Various messaging operations
Usage: Communication, notifications, status updates
Implementation: Search MCP documentation for detailed usage instructions

MCP Server Discovery Protocol:
 Search MCP Servers Config files for additional servers
 Scan MCP Directory for undocumented servers
 Document all discovered servers in plan.md
 Research usage instructions for each server
 Integrate new servers into development workflow

MCP Integration Strategy:
Knowledge Management:
 Use Memory server to track project entities and relationships
 Store Code Instructor preferences and feedback
 Maintain development context and learned information

Research and Information Gathering:
 Use Fetch server to gather documentation and resources
 Extract relevant information for implementation decisions

Code Development:
 Use Octocode for code generation assistance
 Use Build-my-own for template initialization
 Use File System for project file management

Communication:
 Use Message-mcp for status updates and notifications
 Maintain clear communication with Code Instructor

Parallel Processing:
 Use Concurrent-browser-mcp for simultaneous operations
 Optimize development workflow with parallel tasks

Quality Assurance Protocols
Code Standards Enforcement:
 Maintain minimal code complexity
 Ensure comprehensive commenting
 Follow DRY principles
 Implement proper error handling
 Maintain consistent naming conventions

Testing Requirements:
 100% unit test coverage
 Integration testing for all components
 End-to-end testing for user flows
 Performance testing for critical paths
 Security testing for sensitive operations

Documentation Standards:
 README.md with project overview
 Technical documentation for all components
 User manual for application features
 Contribution guidelines
 Deployment instructions

Phase 3: Project Completion and Delivery
Final Verification Process:

Task Completion Check:
 Verify all plan.md tasks are checked off
 Confirm all features are implemented
 Validate all testing requirements met

Documentation Review:
 Final README.md review
 Complete technical documentation
 Final user manual review
 Contribution guidelines verification

Code Instructor Approval:
 Request final project review
 Address any feedback
 Get official project completion confirmation
Recovery and Failsafe Mechanisms

Environment Recovery:
 Automated environment setup scripts
 Version-controlled configuration files
 Database backup and restore procedures
 Dependency lock files for consistent builds

Progress Recovery:
 Daily progress snapshots
 Git version control with descriptive commits
 plan.md as single source of truth
 Automated backup of critical files

Communication Protocols:
 Regular status updates to Code Instructor
 Immediate notification of critical blocks
 Detailed reporting of deviations
 Request for guidance on architectural decisions

Current Status Summary
Completed Objectives:
 Workflow specification established
 Development protocols defined
 Block handling procedures documented
 Quality assurance standards set
 MCP servers integration planned

Pending Actions:
 Request application specifications from Code Instructor
 Gather required environment credentials
 Generate detailed plan.md document
 Get plan approval from Code Instructor
 Create comprehensive project summary

Next Steps:
Execute Objective 1: Request application details
Execute Objective 2: Collect environment configuration
Execute Objective 3: Generate and refine plan.md
Begin Phase 2 implementation based on approved plan.md
