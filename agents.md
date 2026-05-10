# Agents

This document describes the AI agents and automated systems used in the nsw-leave-calc project.

## Overview

The nsw-leave-calc repository uses AI-powered agents to assist with:
- Code generation and completion
- Testing and quality assurance
- Documentation generation
- Code review and analysis

## Agent Types

### 1. Code Completion Agent
- **Purpose**: Assists with code generation and autocompletion
- **Scope**: Development workflows
- **Integration**: GitHub Copilot

### 2. Documentation Agent
- **Purpose**: Helps generate and maintain documentation
- **Scope**: README files, code comments, API documentation

### 3. Testing Agent
- **Purpose**: Supports test creation and validation
- **Scope**: Unit tests, integration tests, test coverage analysis

## Guidelines for Agent Usage

1. **Code Quality**: Always review AI-generated code for:
   - Security vulnerabilities
   - Performance implications
   - Adherence to project standards
   - Edge case handling

2. **Documentation**: AI-generated docs should be:
   - Reviewed for accuracy
   - Verified against actual implementation
   - Updated as code changes

3. **Testing**: AI-generated tests should:
   - Cover critical paths
   - Include edge cases
   - Match project testing conventions

## Best Practices

- Always run linters and formatters before committing
- Review AI suggestions critically
- Use AI as a tool to accelerate development, not replace human judgment
- Document any custom configurations or preferences

## Configuration

Agent behavior can be customized through:
- `.github/` configuration files
- IDE settings
- Project-specific guidelines

## Related Documents

- [AI Handover Guide](./AI_HANDOVER.md)
- Project README
