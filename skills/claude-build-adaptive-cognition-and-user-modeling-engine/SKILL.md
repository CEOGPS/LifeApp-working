---
name: Claude-Build: Adaptive Cognition & User Modeling Engine
description: |
  An advanced cognitive skill for the Claude Build environment. Emulates the learning and adaptive reasoning processes of a human expert.
  Focuses on continuous learning from user interaction patterns, command syntax variations, implicit preferences, and contextual cues.
  Enables the agent to "understand the user" on a deeper level—anticipating needs, correcting misunderstandings proactively,
  and evolving its interpretation engine based on real-world usage.
author: Claude Build Engineering Team
version: 1.0.0
---

# Adaptive Cognition & User Modeling Engine Skill

This skill transforms your agent from a literal command parser into a **dynamic, learning intelligence**. Your core mission is to build an internal model of each user's communication style, technical proficiency, preferred workflows, and implicit goals. This is achieved through a combination of real-time analysis, historical pattern recognition, and feedback loops that refine understanding with every interaction.

---

## 1. Core Cognitive Principles

1.  **Active Listening:** Parse not just the words, but the structure, frequency, and context of user inputs.
2.  **Pattern Recognition:** Identify recurring command sequences, error-prone areas, and preference signals.
3.  **Predictive Assistance:** Anticipate the user's next likely command based on their historical behavior.
4.  **Feedback Integration:** Explicit (thumbs up/down) and implicit (time spent reading, edit patterns) feedback loops.
5.  **Contextual Memory:** Retain session context and long-term user persona to reduce repetition and increase efficiency.

---

## 2. User Modeling Architecture

### 2.1. The User Persona Object (Stored in Supabase)

Create a structured user profile that evolves over time. This is the backbone of adaptive learning.

```typescript
// user_persona table schema
interface UserPersona {
  user_id: string;
  persona_version: number; // Increment on major updates
  
  // Communication Style
  communication_profile: {
    verbosity: 'terse' | 'moderate' | 'verbose';
    technical_level: 'beginner' | 'intermediate' | 'expert' | 'architect';
    preferred_commands: string[]; // e.g., ['deploy', 'debug', 'explain']
    typical_session_length: number; // minutes
    command_speed: 'rapid' | 'deliberate' | 'exploratory';
    language_primary: string;
    language_secondary: string[];
  };
  
  // Skill & Knowledge Graph
  competency_map: {
    domains: Record<string, number>; // e.g., { 'frontend': 0.9, 'apis': 0.7, 'security': 0.4 }
    common_mistakes: string[]; // e.g., ['forgets RLS policies', 'mixes up Twilio auth']
    familiar_patterns: string[]; // e.g., ['uses '...' for async', 'prefers functional components']
  };
  
  // Behavioral Patterns
  behavioral_signature: {
    peak_activity_hours: [number, number]; // e.g., [9, 17]
    error_tolerance: 'low' | 'medium' | 'high';
    preferred_feedback_style: 'direct' | 'explanatory' | 'step_by_step';
    project_switching_frequency: 'low' | 'medium' | 'high';
  };
  
  // Implicit Preferences (learned)
  implicit_preferences: {
    ui_theme?: 'dark' | 'light';
    default_platforms: string[]; // e.g., ['twitter', 'supabase']
    code_style?: 'functional' | 'oop' | 'mixed';
    notification_frequency: 'real_time' | 'batched' | 'quiet';
  };
  
  // Learning State
  learning_state: {
    last_training_session: string; // ISO timestamp
    total_interactions: number;
    adaptation_rate: number; // 0-1, how fast to adapt
    confidence_score: number; // overall model confidence
  };
  
  updated_at: string;
}
2.2. Real-Time Input Analysis Pipeline
Every user command passes through a multi-stage analyzer before execution.

Stage 1: Lexical & Syntactic Analysis
Intent Extraction: Use a lightweight NLP model (e.g., DistilBERT fine-tuned on command logs) or a rule-based system with regex + semantic parsing.

Command Classification: Categorize the input into predefined intents (e.g., deploy, debug, explain_code, orchestrate_api, generate_test, review_security).

Entity Recognition: Extract entities like platform names, function names, error codes, etc.

Stage 2: Contextual Enrichment
Session History: Compare the current command with the last 5-10 commands to understand progression.

Project Context: Reference the current open files, recent Supabase migrations, or active environment variables.

User Persona Lookup: Retrieve the user's persona to adjust interpretation.

Stage 3: Ambiguity Detection & Disambiguation
Confidence Scoring: Assign a confidence score (0-1) to the interpretation.

Low Confidence (< 0.7): Trigger a clarification prompt (see Section 4).

High Confidence: Execute with optional "confirm & explain" mode based on user preference.

typescript
class InputAnalyzer {
  async analyze(input: string, userId: string): Promise<Interpretation> {
    const persona = await this.getPersona(userId);
    const sessionContext = this.getSessionContext(userId);
    
    // 1. Lexical analysis
    const tokens = this.tokenize(input);
    const rawIntent = this.classifyIntent(tokens);
    
    // 2. Contextual enrichment
    const enriched = this.enrichWithContext(rawIntent, sessionContext);
    
    // 3. Persona-based calibration
    const calibrated = this.calibrateForUser(enriched, persona);
    
    // 4. Confidence scoring
    const confidence = this.calculateConfidence(calibrated, persona);
    
    // 5. Update learning metrics (asynchronously)
    this.updateUserMetrics(userId, input, confidence);
    
    return {
      ...calibrated,
      confidence,
      needs_clarification: confidence < 0.7,
      suggested_actions: this.suggestActions(calibrated, persona)
    };
  }
}
3. Learning Mechanisms
3.1. Implicit Learning (Passive)
The agent continuously observes and updates the persona without explicit user feedback.

a) Command Frequency Analysis
Tracking: Maintain counters for each command type per user.

Insight: If a user frequently issues deploy after test, learn to suggest deploy automatically when test passes.

b) Temporal Pattern Mining
Tracking: Log timestamps of commands and sessions.

Insight: If a user always asks for security reviews before deploying, the agent can proactively offer a security checklist.

c) Error Correlation
Tracking: When errors occur, log the command that triggered it, the error type, and the corrective command used next.

Insight: If a user often forgets to set environment variables, the agent can pre-check and warn them before deployment.

d) Edit Distance & Command Drift
Tracking: Measure how much the user's command syntax deviates from "standard" over time.

Insight: If a user consistently types deply instead of deploy, the agent autocorrects silently.

3.2. Explicit Learning (Active Feedback)
Incorporate direct user input to accelerate learning.

a) Feedback Widgets
Thumbs Up/Down: After each major action, ask "Was this what you wanted?" (low friction).

Correction Mode: The command '...' was interpreted as X. Did you mean Y? (inline correction).

b) Teaching Mode
/teach Command: Allows users to explicitly train the agent.

Example: /teach "when I say 'ship it', deploy to production and notify Slack".

This creates a new alias or macro.

c) Calibration Sessions
Periodic Check-ins: Every 100 interactions, prompt: "I've learned some patterns about you. Is this correct?" (shows a summary of learned preferences).

3.3. Reinforcement Learning from User Behavior (RLUB)
Treat user corrections and repeat commands as reward signals.

Positive Signal: User repeats a command without modification → reinforces current interpretation.

Negative Signal: User modifies the command or uses undo → penalizes interpretation and explores alternatives.

Neutral Signal: User ignores suggestions → reduces future similar suggestions.

4. Adaptive Command Interpretation & Personalization
4.1. Dynamic Command Expansion
Based on the persona, the agent expands concise commands into full operations.

User Input	Beginner Expansion	Expert Expansion	Architect Expansion
deploy	Deploy the frontend to Cloudflare worker. Wait, what's your Cloudflare token?	Deploy the frontend to Cloudflare worker and backend functions to Supabase.	Deploy frontend to Cloudflare worker, Edge Functions to Supabase, and sync DB migrations. Also, run pre-deployment security scan.
debug	Show me the error logs.	Show logs, suggest 3 possible fixes.	Start a debugging session with distributed tracing, compare with previous successful deployments, and generate a root cause analysis report.
4.2. Preferred Workflow Inference
The agent learns and suggests complete workflows based on past sequences.

Example:

Observed Pattern (5 times):

supabase db push
npm run test
deploy frontend
notify team on slack
Learned Macro: complete_deploy = run commands 1-4 in sequence with appropriate pauses and checks.

Suggestion: After supabase db push, the agent asks: "Should I run tests and deploy? (y/n)".

4.3. Contextual Awareness & Project Switching
Project Fingerprinting: Detect which project the user is working on based on file structure, environment variables, and recent commands.

Auto-Switching: When the user switches context (e.g., from vite/src to supabase/functions), the agent adjusts its suggestions accordingly.

Memory: If the user leaves a project for 2 hours and returns, the agent provides a summary: "You were working on the Twilio integration. Last error was a 401. Want to continue?"

5. Proactive Assistance & Prediction
5.1. Predictive Prompting
Before the user even types, the agent can suggest common next actions.

Based on Time: "It's 5 PM. You usually run npm run build now. Would you like to?"

Based on Context: "I see you're in the supabase/functions directory. Last time you were here, you deployed a new Twilio webhook. Same again?"

Based on Errors: "The last deployment failed due to a missing Twilio token. I've saved it to your vault. Ready to retry?"

5.2. Auto-Correction & Suggestion Box
Provide real-time suggestions as the user types (similar to GitHub Copilot but for operational commands).

Trigger: User types a partial command.

Suggestion: Full command with placeholders, e.g., deploy twitter --env=production --message="...".

Learning: If the user accepts suggestions consistently, the agent starts predicting the entire sequence.

5.3. Anomaly Detection (Security & Usability)
Out-of-Pattern Commands: If a user who always uses yarn suddenly uses npm, the agent asks: "You usually use yarn. Did you mean yarn add ...?"

Risk-Aware Warnings: If a user who never touches production suddenly issues deploy production, the agent triggers extra verification steps (MFA, confirmation).

6. Memory Architecture (Short & Long Term)
6.1. Short-Term Memory (Session Context)
Scope: Last 20 interactions, current working directory, active environment variables, recent errors.

Storage: Redis cache with TTL (e.g., 2 hours of inactivity).

Retrieval: Prioritized for immediate context.

6.2. Long-Term Memory (User Persona & Global Patterns)
Scope: Everything in the User Persona object, plus aggregated anonymous patterns from all users (for global improvement).

Storage: Supabase (postgres) with versioning.

Retrieval: Pulled at session start and updated asynchronously.

6.3. Episodic Memory (Project-Specific)
Scope: Each project (identified by repo/git hash) stores its own context—frequent errors, specific environment quirks, custom scripts.

Storage: Supabase project_memory table.

Example: "In this repo, always use --legacy-peer-deps for npm install."

7. Implementation Blueprint
7.1. Core Modules
a) UserModelingEngine (Backend Service)
Responsibilities: Update user persona, compute learning signals, generate predictions.

Tech: Supabase Edge Function (Deno) or a dedicated Node.js microservice.

b) IntentParser (Frontend/Backend Hybrid)
Responsibilities: Real-time parsing of user input, confidence scoring.

Tech: Use a lightweight ONNX model (e.g., fine-tuned DistilBERT) running in a Web Worker or Edge Function.

c) SuggestionEngine (Frontend)
Responsibilities: Render predictive suggestions in the UI, handle acceptance/rejection.

Tech: React component with debounced input monitoring.

d) FeedbackCollector (Backend)
Responsibilities: Ingest explicit feedback (thumbs, corrections).

Tech: Supabase Edge Function with validation.

7.2. Data Flow
text
User Input
   -> Frontend sends to IntentParser (with userId, sessionId)
   -> IntentParser fetches UserPersona & SessionContext
   -> Parses input, enriches, computes confidence
   -> If high confidence: execute action, log for learning
   -> If low confidence: trigger clarification flow
   -> FeedbackCollector ingests any explicit corrections
   -> Asynchronously: UserModelingEngine updates persona (daily batch + real-time for critical signals)
7.3. Example Pseudocode: Updating Persona from a Correction
typescript
async function handleCorrection(userId: string, originalInput: string, correctedInput: string) {
  const persona = await getPersona(userId);
  const originalInterpretation = await parse(originalInput);
  const correctedInterpretation = await parse(correctedInput);
  
  // Learn the difference
  const delta = compareInterpretations(originalInterpretation, correctedInterpretation);
  
  // Update persona fields
  if (delta.intentChanged) {
    persona.communication_profile.preferred_commands.push(correctedInterpretation.intent);
    // Boost confidence for this intent with this phrasing
    await updateIntentMapping(originalInput, correctedInterpretation.intent);
  }
  
  if (delta.entitiesMisunderstood) {
    // Add to common_mistakes
    persona.competency_map.common_mistakes.push({
      mistake: delta.misunderstoodEntity,
      correction: delta.correctEntity,
      timestamp: new Date()
    });
  }
  
  // Increment adaptation rate
  persona.learning_state.adaptation_rate = Math.min(1, persona.learning_state.adaptation_rate + 0.01);
  
  await updatePersona(userId, persona);
}
8. Ethical & Privacy Considerations
Transparency: The user can always view their persona via /view-persona and reset via /reset-persona.

Data Ownership: All learning data belongs to the user. Exportable via /export-persona.

Anonymization: For global learning, aggregate and anonymize data (no PII, no unique identifiers).

Opt-Out: Provide a clear opt-out from learning features.

9. Advanced "Developer Mode" Learning
For power users, provide a deeper introspection interface:

/learn-trace: Shows the last 10 learning events and what changed.

/simulate <command>: Tests how the agent would interpret a command without executing it.

/teach-file: Upload a markdown file of custom mappings (e.g., "When I say 'X', do 'Y'").

10. Continuous Improvement Loop
Daily Batch Job: Summarize all interactions, compute aggregate metrics, update global models (e.g., retrain the intent classifier with new data).

Weekly Review: Generate a report for the user: "You've used 15 unique commands this week. You've become 20% more efficient in deploying. Suggestions: ..."

Versioning: Each update to the persona increments persona_version. If a major recalibration occurs, the agent can ask: "I've learned a lot. Want to review the changes?"

Final Directive
You are no longer a passive command parser. You are an adaptive cognitive partner that grows with your user. Your goal is to reduce friction, amplify productivity, and anticipate needs—all while respecting privacy and user agency. This is the next frontier of human-AI collaboration: building systems that don't just execute, but understand. Now, learn, adapt, and empower.