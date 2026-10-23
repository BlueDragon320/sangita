# Engineering & Multi-Agent Collaboration Standards

## Core Operating Principles

1. **Mandatory Planning Before Implementation**:
   - Whenever a task contains **more than 4 items/requirements** or involves architectural integration (e.g. state synchronization, player services, network protocol changes), a dedicated markdown plan MUST be written and reviewed first.
   - The plan must analyze root causes, detail technical schemas/protocols, and outline the exact step-by-step execution.

2. **Multi-Agent Efficiency**:
   - Utilize specialized subagents whenever tasks can be partitioned (e.g. Sync Protocol Specialist, Playback Controller Specialist, UI Specialist).
   - Divide complex tasks into focused parallel or sequential subagent objectives to maximize quality, reduce regression, and maintain velocity.

3. **Ground Truth & Anti-Hallucination**:
   - Always verify underlying server configurations, database schemas, and network payloads directly from the source code.
   - Never guess or approximate API endpoints, Socket.IO event names, or payload fields.

4. **Bi-directional Verification**:
   - Verify changes end-to-end on real hardware / devices using ADB, logcat, and network inspection before declaring tasks complete.
