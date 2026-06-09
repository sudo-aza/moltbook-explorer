const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat,
  TableOfContents, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak,
  FootnoteReferenceRun, Footnote
} = require("docx");

// ── Color palette: "Midnight Code" ──
const C = {
  primary:   "020617",
  body:      "1E293B",
  secondary: "64748B",
  accent:    "94A3B8",
  tableBg:   "F8FAFC",
  tableHdr:  "F1F5F9",
  white:     "FFFFFF",
  codeBlock: "0F172A",
  codeText:  "E2E8F0",
  link:      "3B82F6",
};

// ── Table helpers ──
const tBorder = { style: BorderStyle.SINGLE, size: 8, color: C.accent };
const cellBorders = { top: tBorder, bottom: tBorder, left: tBorder, right: tBorder };

function hdrCell(text, width) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: C.tableHdr, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 40, line: 250 },
      children: [new TextRun({ text, bold: true, font: "Calibri", size: 22, color: C.primary })]
    })]
  });
}

function dataCell(text, width, opts = {}) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { before: 40, after: 40, line: 250 },
      children: [new TextRun({ text, font: "Calibri", size: 22, color: C.body })]
    })]
  });
}

function makeTable(headers, rows, colWidths) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    alignment: AlignmentType.CENTER,
    columnWidths: colWidths,
    margins: { top: 80, bottom: 80, left: 150, right: 150 },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => hdrCell(h, colWidths[i]))
      }),
      ...rows.map(row => new TableRow({
        children: row.map((cell, i) => dataCell(cell, colWidths[i], { center: i === 0 }))
      }))
    ]
  });
}

function tableCaption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 200, line: 250 },
    children: [new TextRun({ text, font: "Calibri", size: 18, color: C.secondary, italics: true })]
  });
}

// ── Body paragraph helper ──
function bodyP(text, opts = {}) {
  const runs = [];
  if (typeof text === "string") {
    runs.push(new TextRun({ text, font: "Calibri", size: 22, color: C.body }));
  } else {
    runs.push(...text);
  }
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: opts.spaceBefore || 0, after: opts.spaceAfter || 120, line: 250 },
    children: runs,
  });
}

function boldRun(text) {
  return new TextRun({ text, font: "Calibri", size: 22, color: C.body, bold: true });
}

function normalRun(text) {
  return new TextRun({ text, font: "Calibri", size: 22, color: C.body });
}

function codeRun(text) {
  return new TextRun({ text, font: "Courier New", size: 20, color: C.codeBlock });
}

function italicRun(text) {
  return new TextRun({ text, font: "Calibri", size: 22, color: C.body, italics: true });
}

function accentRun(text) {
  return new TextRun({ text, font: "Calibri", size: 22, color: C.secondary, italics: true });
}

// ── Bullet / numbered list items ──
function bulletItem(ref, text) {
  const runs = typeof text === "string"
    ? [new TextRun({ text, font: "Calibri", size: 22, color: C.body })]
    : text;
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { before: 40, after: 40, line: 250 },
    children: runs,
  });
}

function numItem(ref, text) {
  const runs = typeof text === "string"
    ? [new TextRun({ text, font: "Calibri", size: 22, color: C.body })]
    : text;
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { before: 40, after: 40, line: 250 },
    children: runs,
  });
}

// ── Footnotes ──
const footnotes = {
  1: { children: [new Paragraph({ spacing: { line: 250 }, children: [new TextRun({ text: "The ReAct pattern was introduced by Yao et al. (2022) in 'ReAct: Synergizing Reasoning and Acting in Language Models.' It remains the foundational paradigm for most agent frameworks as of 2026.", font: "Calibri", size: 18, color: C.secondary })] })] },
  2: { children: [new Paragraph({ spacing: { line: 250 }, children: [new TextRun({ text: "Context window sizes have expanded dramatically: from 8K tokens in early GPT-3 deployments to 2M tokens in Gemini 2.0, though effective useful context remains far smaller due to attention dilution effects.", font: "Calibri", size: 18, color: C.secondary })] })] },
  3: { children: [new Paragraph({ spacing: { line: 250 }, children: [new TextRun({ text: "The term 'context rot' was coined in practitioner communities circa late 2024 to describe the gradual degradation of agent performance as conversations extend beyond a few dozen turns.", font: "Calibri", size: 18, color: C.secondary })] })] },
  4: { children: [new Paragraph({ spacing: { line: 250 }, children: [new TextRun({ text: "Tool hallucination rates vary by model but can reach 15-30% for large tool catalogs (>50 tools) according to internal benchmarks by LangChain and OpenAI.", font: "Calibri", size: 18, color: C.secondary })] })] },
  5: { children: [new Paragraph({ spacing: { line: 250 }, children: [new TextRun({ text: "The orchestrator-worker pattern is analogous to MapReduce in distributed computing, where a coordinator node distributes work and aggregates results from worker nodes.", font: "Calibri", size: 18, color: C.secondary })] })] },
  6: { children: [new Paragraph({ spacing: { line: 250 }, children: [new TextRun({ text: "Persistent agent identity through externalized memory is an active research area, sometimes called 'memory-augmented agentic systems' or 'long-term memory for LLMs.'", font: "Calibri", size: 18, color: C.secondary })] })] },
};

function fnRef(id) {
  return new FootnoteReferenceRun(id);
}

// ═══════════════════════════════════════════════════════
// CONTENT SECTIONS
// ═══════════════════════════════════════════════════════

function section1() {
  return [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. The State of Agentic AI (2026)")] }),

    bodyP([
      normalRun("By early 2026, large language models have undergone a qualitative transformation from sophisticated chatbots into genuinely autonomous agents capable of navigating the open-ended complexity of real-world tasks. What began as simple text-in, text-out systems has evolved into architectures that can observe environments, reason about goals, execute multi-step plans, and self-correct when things go wrong. The shift was not sudden — it emerged from the convergence of several technical breakthroughs: improved chain-of-thought reasoning, reliable function calling interfaces, sandboxed code execution environments, and the development of agentic frameworks that stitched these capabilities together into coherent loops. The result is a new class of software that does not merely answer questions but "),
      boldRun("accomplishes tasks"),
      normalRun(", and the distinction between these two modes of operation is the central theme of this document."),
    ]),

    bodyP([
      normalRun("The fundamental architecture underpinning virtually every production agent in 2026 is the "),
      boldRun("observe-reason-act loop"),
      normalRun(". In its simplest form, the agent receives some task or observation (a user request, a file change, a web page update), reasons about what to do next (using its language model to generate a plan or decision), and then acts by invoking a tool, writing code, making an API call, or producing output. The result of that action becomes a new observation, feeding back into the loop. This cycle repeats until the agent determines the task is complete — or until it runs out of context, hits a rate limit, or encounters a failure it cannot recover from. Despite its apparent simplicity, this loop is deceptively powerful, and understanding its failure modes is essential for building reliable systems."),
    ]),

    bodyP([
      normalRun("The ecosystem of agent frameworks has matured significantly. "),
      boldRun("LangChain"),
      normalRun(" and its LangGraph extension provide a graph-based orchestration layer for building complex multi-step agents with conditional branching and human-in-the-loop checkpoints. "),
      boldRun("CrewAI"),
      normalRun(" offers a role-based multi-agent framework where agents assume specific personas and collaborate on tasks. Microsoft's "),
      boldRun("AutoGen"),
      normalRun(" enables multi-agent conversations with flexible topologies. Claude's computer-use capability allows direct interaction with desktop environments, while OpenAI's function calling has become the de facto standard tool interface. Each of these frameworks implements variations of the same core loop, and each has its own approach to the universal challenges of context management, tool orchestration, and failure recovery."),
      fnRef(1),
    ]),

    bodyP([
      normalRun("The promise of agentic AI is compelling: systems that can browse the web to gather information, write and execute code to solve problems, manage file systems and databases, interact with APIs, and compose all of these capabilities into end-to-end workflows. A user can ask an agent to 'research the top competitors in the electric vehicle market, build a financial model, and produce a 20-page analyst report' — and receive a polished deliverable within minutes. In demonstrations, these systems are dazzling. But the gap between a curated demo and production reliability remains enormous. Agents fail in ways that are subtle, unpredictable, and often invisible until a human reviews the output. The remainder of this document explores why that gap exists and what architectural patterns can close it."),
    ]),
  ];
}

function section2() {
  return [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. Anatomy of the Agent Loop")] }),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The ReAct Pattern")] }),

    bodyP([
      normalRun("The ReAct (Reason + Act) pattern, introduced by Yao et al. in 2022, remains the most influential paradigm for agent design."),
      fnRef(1),
      normalRun(" In a ReAct agent, the model is prompted to interleave reasoning steps with action steps. Before invoking a tool, the model generates a 'thought' — a natural-language explanation of why it is choosing a particular action. After receiving the tool's result, the model generates another thought reflecting on what it learned. This thinking-aloud approach has several advantages: it makes the agent's decision-making process interpretable (at least in principle), it helps the model maintain coherence across multiple steps, and it provides a natural audit trail for debugging failures. In practice, the reasoning quality varies enormously across models and tasks, but the pattern itself is nearly universal in production agent systems."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Tool Calling as Backbone")] }),

    bodyP([
      normalRun("Tool calling — sometimes called function calling — is the mechanism by which an agent interfaces with the external world. Rather than generating free-text responses that a human must interpret and act upon, the model emits structured JSON specifying which tool to invoke and with what parameters. The runtime system validates these parameters, executes the tool, and returns the result as a structured message in the conversation. This creates a clean abstraction boundary: the model decides "),
      italicRun("what"),
      normalRun(" to do, and the tool system handles "),
      italicRun("how"),
      normalRun(" to do it. OpenAI's function calling format, which has been adopted by most other providers, defines tools with names, descriptions, and JSON schemas for their parameters. The quality of these descriptions directly determines the quality of tool selection — poorly described tools are poorly used tools, a point we will explore in depth in Section 5."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Single Turn in Detail")] }),

    bodyP([
      normalRun("A single turn through the agent loop involves several distinct phases. First, the system prompt is assembled, combining the agent's base instructions, the current task description, available tool definitions, and any relevant context from previous turns. Second, this combined prompt is sent to the language model for inference. Third, the model's response is parsed: if it contains a tool call, that call is dispatched; if it contains free text, it may be presented to the user or stored as an observation. Fourth, the tool executes and produces a result (which may be structured data, a file path, an error message, or raw text). Fifth, the tool result is appended to the conversation history, becoming part of the context for the next turn. Each of these phases introduces potential failure points, and the cumulative effect of small errors across many turns is one of the primary challenges in agent reliability."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Implicit vs. Explicit Planning")] }),

    bodyP([
      normalRun("Agents can approach task planning in two fundamentally different ways. In "),
      boldRun("explicit planning"),
      normalRun(" (also called plan-then-execute), the agent first generates a complete step-by-step plan, then executes each step sequentially. This approach has the advantage of making the agent's intentions transparent and allows for plan validation before execution begins. However, explicit plans are brittle: the agent cannot anticipate every obstacle, and a single failed step can invalidate the entire plan. In "),
      boldRun("implicit planning"),
      normalRun(" (or real-time reasoning), the agent decides what to do next at each turn based on its current understanding. This is more flexible — the agent can adapt to unexpected results — but less predictable and harder to debug. Most production systems use a hybrid approach: generate a high-level plan, but re-plan dynamically when execution deviates from expectations."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Tool Descriptions as Sensory Organs")] }),

    bodyP([
      normalRun("An often-underappreciated insight is that tool descriptions function as the agent's sensory organs. Just as a human's perception of the world is shaped by what their eyes and ears can detect, an agent's perception of available actions is entirely determined by the tool descriptions in its prompt. If a tool for reading files is described as 'reads text files from disk,' the agent may not realize it can also read configuration files, CSV data, or source code. If a web browsing tool does not mention JavaScript rendering, the agent will assume it cannot handle dynamic content. The precision, completeness, and structure of tool descriptions are therefore among the most important determinants of agent behavior, often more impactful than model choice or system prompt engineering."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Categories of Tools")] }),

    bodyP([
      normalRun("Tools available to agents in 2026 can be broadly categorized into several types. "),
      boldRun("Code execution environments"),
      normalRun(" (such as Jupyter-style sandboxes or containerized shells) allow agents to write and run arbitrary code — the single most powerful tool category, as code can implement virtually any logic. "),
      boldRun("File system tools"),
      normalRun(" enable reading, writing, searching, and navigating directories — essential for multi-file tasks like software development. "),
      boldRun("API clients"),
      normalRun(" allow interaction with external services: databases, cloud platforms, payment systems, version control, and more. "),
      boldRun("Web browsing tools"),
      normalRun(" provide access to the live internet for research, monitoring, and information retrieval. "),
      boldRun("Communication tools"),
      normalRun(" enable agents to send messages, create issues, post comments, or trigger workflows in collaboration platforms. Each category introduces its own failure modes, latency characteristics, and security considerations, and the system prompt must carefully define the boundaries of what the agent can and should do with each."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The System Prompt as Operating System")] }),

    bodyP([
      normalRun("The system prompt is the closest analogue to an operating system that an agent has. It defines the agent's identity, capabilities, constraints, and behavioral guidelines. A well-crafted system prompt specifies: the agent's role and expertise; which tools are available and how to use them; what constitutes success and failure; how to handle errors and edge cases; when to ask for human help; and what output format is expected. The system prompt is typically the single largest consumer of context tokens — often 2,000 to 10,000 tokens — and its quality has an outsized impact on agent behavior. Small changes in wording can produce dramatically different tool selection patterns, error handling behaviors, and output quality. System prompt engineering is therefore not merely a prompt engineering task but a software engineering discipline with its own best practices, testing methodologies, and version control requirements."),
    ]),
  ];
}

function section3() {
  return [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. The Context Window Problem")] }),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Finite Context Budget")] }),

    bodyP([
      normalRun("Every large language model operates within a finite context window — the maximum number of tokens it can process in a single inference call."),
      fnRef(2),
      normalRun(" As of 2026, context windows range from roughly 8,000 tokens (for smaller, faster models) to 2 million tokens (for Gemini-class models). However, the effective useful context — the portion of the window where the model maintains high-quality reasoning and attention — is typically far smaller than the theoretical maximum. Research has consistently shown that models exhibit 'attention dilution' in the middle of long contexts, with information near the beginning and end being better recalled than information in the middle (the so-called 'lost in the middle' phenomenon). A model with a 200K token context window may effectively lose track of details introduced at token 50K by the time the conversation reaches token 150K."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("What Consumes Context")] }),

    bodyP([
      normalRun("Context is consumed by multiple sources, each of which must be budgeted carefully. The "),
      boldRun("system prompt"),
      normalRun(" typically consumes 2,000 to 10,000 tokens, depending on the complexity of the agent's instructions and the number of tool definitions. The "),
      boldRun("tool definitions"),
      normalRun(" themselves — including names, descriptions, and JSON schemas — can consume 1,000 to 20,000 tokens for a rich toolset. The "),
      boldRun("conversation history"),
      normalRun(" (all prior user messages, model responses, and tool calls) grows linearly with each turn. And the "),
      boldRun("tool results"),
      normalRun(" are often the largest consumer: a single file read operation might return 5,000 tokens; a web page scrape might return 10,000; a code execution output might return 50,000 or more. The model's own "),
      boldRun("generated output"),
      normalRun(" also consumes tokens, including reasoning traces and tool call specifications. All of these must fit within the context window simultaneously, and the budget must be managed proactively rather than reactively."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Math of Multi-Step Consumption")] }),

    bodyP([
      normalRun("Consider a realistic scenario: an agent is tasked with building a web application from scratch. The system prompt plus tool definitions consume 8,000 tokens. Each turn, the model generates roughly 500 tokens of reasoning plus a tool call specification. Each tool result averages 3,000 tokens (reading files, running commands, etc.). Over 20 turns, the conversation history alone consumes 20 \u00d7 (500 + 3,000) = 70,000 tokens. Add the initial 8,000 for setup, and the total is 78,000 tokens — well within a 128K context window, but leaving only 50,000 tokens for the model to reason with at any given time. If any single tool result is unexpectedly large (say, a 30,000-token error log from a failed build), it can push out a significant portion of the conversation history, causing the agent to lose track of earlier decisions. This mathematical reality is why context management is not an optimization but a survival requirement for any non-trivial agent task."),
    ]),

    makeTable(
      ["Context Consumer", "Typical Token Range", "Growth Pattern"],
      [
        ["System prompt", "2K – 10K", "Fixed per session"],
        ["Tool definitions", "1K – 20K", "Fixed per session"],
        ["Model output per turn", "200 – 1,500", "Linear with turns"],
        ["Tool result per turn", "500 – 50,000+", "Variable, often large"],
        ["Conversation history", "Sum of all above", "Cumulative"],
      ],
      [3200, 2800, 3360]
    ),
    tableCaption("Table 1: Context token consumption breakdown for a typical multi-step agent task."),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Strategies for Context Management")] }),

    bodyP([
      normalRun("Several strategies exist for managing context consumption, each with tradeoffs. "),
      boldRun("Conservative budget allocation"),
      normalRun(" assigns fixed token budgets to each tool type and truncates results that exceed their budget. This is simple but may discard important information. "),
      boldRun("Sliding window"),
      normalRun(" approaches keep only the most recent N turns in context, discarding older turns entirely. This prevents context overflow but guarantees information loss. "),
      boldRun("Summarization"),
      normalRun(" compresses older turns into condensed summaries before discarding them. This preserves high-level context but loses the details needed for technical tasks. "),
      boldRun("Priority-based pruning"),
      normalRun(" uses heuristics or a separate model to rank the importance of each context element and evict the least important ones. This is the most sophisticated approach but adds latency and complexity. "),
      boldRun("RAG-style retrieval"),
      normalRun(" stores conversation history in a vector store and retrieves relevant excerpts on demand rather than keeping everything in context. This scales well but introduces retrieval latency and may miss critical context that doesn't match the current query. In practice, production systems typically combine several of these strategies."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Fundamental Tradeoff")] }),

    bodyP([
      normalRun("All context management strategies confront a fundamental tradeoff: more context enables better reasoning (the model has more information to work with) but comes at the cost of slower inference (quadratic attention cost) and higher expense (more tokens = more money). There is also an upper bound on useful context beyond which adding more tokens actually "),
      italicRun("degrades"),
      normalRun(" performance due to attention dilution. The optimal context size varies by task complexity, model capability, and the nature of the information being maintained. For simple, well-defined tasks, a small context window may be sufficient; for complex, multi-step tasks that require integrating information across many steps, the context window is often the binding constraint on reliability. This constraint is the primary motivation for the architectural patterns described in Sections 7 through 9."),
    ]),
  ];
}

function section4() {
  return [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("4. Context Rot \u2014 The Silent Failure Mode")] }),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Defining Context Rot")] }),

    bodyP([
      boldRun("Context rot"),
      normalRun(" is the gradual degradation of an agent's understanding as relevant information is displaced from the active context window."),
      fnRef(3),
      normalRun(" Unlike a hard crash or an explicit error message, context rot is insidious: the agent continues to operate, generating fluent and seemingly confident output, but its decisions are based on an increasingly incomplete or distorted picture of the task. The term draws an analogy to biological rot — a process that begins slowly, accelerates as it progresses, and can destroy the structural integrity of the entire system before it becomes visible from the outside. In agent systems, context rot is arguably the most dangerous failure mode precisely because it does not look like a failure."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("How It Manifests")] }),

    bodyP([
      normalRun("Context rot manifests in several characteristic patterns. The agent may forget instructions given early in the conversation — for example, a specification that the code should use TypeScript instead of JavaScript, or that the output should be in markdown format. It may repeat mistakes that it previously corrected, because the correction was pushed out of context along with the original mistake. It may lose track of the task's original goal, gradually drifting toward a related but different objective. In multi-file development tasks, the agent may create files that are inconsistent with each other because it has lost track of the project structure it established in earlier steps. In research tasks, it may cite sources it found early on but forget the conclusions it drew from them. Each of these symptoms looks like a reasoning error on the surface, but the root cause is architectural: the information needed for correct reasoning is simply no longer present in the context window."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Why It Is Worse Than a Crash")] }),

    bodyP([
      normalRun("A system that crashes is a system that fails visibly and unambiguously. The user knows something went wrong, can investigate the error, and can retry or adjust. Context rot, by contrast, produces output that appears correct — the code compiles, the report reads well, the API call succeeds — but is fundamentally wrong in ways that may not be apparent until much later. An agent might write a perfectly functional component that uses the wrong data model, or produce a research report that reaches the right conclusion but cites the wrong evidence, or configure a deployment that works in staging but fails in production because it lost track of the environment-specific requirements. These failures are expensive precisely because they are silent: they consume human review time, they erode trust in the agent system, and they can propagate into downstream systems that build on the agent's output."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Lost Thread Problem")] }),

    bodyP([
      normalRun("Multi-step reasoning chains are particularly vulnerable to context rot. When an agent solves a problem across ten or more steps, each step builds on the results and decisions of previous steps. If intermediate results are evicted from context — because a large tool result pushed them out, or because a summarization step glossed over critical details — the agent loses the thread connecting its reasoning. It may redo work it already completed, make decisions that contradict earlier choices, or build on assumptions that are no longer valid. Consider an agent setting up a full-stack project: in step 1, it chooses a directory structure; in step 3, it creates database migrations; in step 7, it writes API endpoints. If by step 7 it has lost track of the schema defined in step 3, it will write endpoints that don't match the database — a failure that will only surface at runtime, possibly in production."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Why Summarization Doesn't Fully Solve It")] }),

    bodyP([
      normalRun("Summarization is the most commonly proposed solution to context rot, and it does help — but it is fundamentally limited. Summaries are lossy by nature: they preserve the gist of what happened but discard the precise details that technical tasks require. A summary might say 'the agent set up a PostgreSQL database with a users table,' but lose the specific column names, types, constraints, and relationships that the agent needs when writing queries against that table. The agent might know that it 'created a configuration file' but not remember the exact values it chose. For tasks involving code, file paths, API schemas, or any structured data, summaries are often insufficient. Furthermore, summarization itself consumes tokens and inference time, and determining "),
      italicRun("what"),
      normalRun(" to summarize requires its own reasoning — which must be done within the context window that is already under pressure."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Compounding Nature of Rot")] }),

    bodyP([
      normalRun("Context rot is not a linear degradation — it compounds. Each piece of lost context makes the next step more likely to produce a suboptimal result, which in turn generates more context that needs to be tracked, which accelerates the eviction of remaining relevant information. An agent that forgets a naming convention in step 5 will create inconsistently named files in steps 6-8, and when it tries to wire them together in step 9, it will face a larger and more confusing set of references than if it had maintained the convention throughout. This compounding effect means that context rot often follows a hockey-stick curve: the agent performs well for the first several steps, then degrades rapidly and catastrophically. The implication for system design is clear: preventing context rot is far more effective than trying to detect or recover from it, and prevention requires architectural solutions — not just better prompts or bigger context windows."),
    ]),
  ];
}

function section5() {
  return [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("5. Tool System Design")] }),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Tool Descriptions Are Prompts")] }),

    bodyP([
      normalRun("One of the most important insights in agent engineering is that tool descriptions are, in effect, prompts. When the model reads a tool definition to decide whether to invoke it, it is performing the same kind of pattern matching and reasoning it applies to any text input. Poorly written tool descriptions lead to poorly understood tools, which leads to poorly used tools. A tool described as 'search files' might be confused with 'search the web' or 'search within a file' depending on the agent's context. A tool described with a terse name like 'exec' gives the model almost no signal about what the tool does, when to use it, or what parameters to provide. Effective tool descriptions follow the same principles as effective prompts: they are specific, they include examples, they specify boundaries and constraints, and they use clear, unambiguous language. The difference between a well-described tool and a poorly described one can easily be the difference between 90% and 40% correct selection rates."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Selection Problem")] }),

    bodyP([
      normalRun("As tool catalogs grow — and production systems routinely have 30 to 80+ tools — the selection problem becomes acute. The model must choose the right tool from a large set based on natural-language descriptions, and this is fundamentally a retrieval task operating within the constraints of the model's attention mechanism. Research has shown that model accuracy on tool selection degrades significantly beyond about 20 tools, with error rates climbing from 5-10% at 20 tools to 25-40% at 80 tools."),
      fnRef(4),
      normalRun(" Strategies for mitigating this include: grouping tools into categories so the model first selects a category then a specific tool; using routing logic that pre-selects a subset of relevant tools based on the task; providing tool usage examples in the system prompt; and implementing fallback mechanisms that detect likely misselections and offer corrections. The selection problem is a hard constraint on how much capability an agent can have in a single context window, and it is one of the strongest arguments for multi-agent architectures where each agent has a smaller, more focused toolset."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Tool Composition and Chaining")] }),

    bodyP([
      normalRun("Real-world tasks rarely require a single tool call; they require sequences of tool calls where the output of one becomes the input to the next. This is tool composition, and it is where agents demonstrate their true value. An agent might search for a file, read its contents, extract specific data, format it as JSON, and write it to a new location — five tool calls chained together with intermediate reasoning. The challenge is that each link in the chain introduces a potential failure point. If the search tool returns a slightly different file path format than expected, the read tool may fail. If the data extraction produces unexpected values, the formatting step may generate invalid JSON. Robust tool composition requires: clear input/output contracts between tools, validation at each step, error recovery mechanisms, and the ability to retry individual steps without restarting the entire chain. Frameworks like LangGraph provide explicit support for these patterns through conditional edges and retry nodes."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Error Handling in Tool Calls")] }),

    bodyP([
      normalRun("Tools fail. APIs return 500 errors, files don't exist, commands time out, and web pages change their structure. How an agent handles tool failures is a critical determinant of overall reliability. The simplest approach is to pass the error message back to the model and let it reason about what to do next. This works when the error is self-explanatory (e.g., 'file not found: /path/to/file') but fails when the error is cryptic or when the model lacks the context to diagnose the problem. More sophisticated approaches include: automatic retries with exponential backoff for transient failures; fallback tools that provide alternative paths to the same information; circuit breakers that stop calling a repeatedly failing tool; and human escalation when the agent encounters errors it cannot resolve after a configurable number of attempts. The key principle is that tool errors should be"),
      italicRun(" expected"),
      normalRun(", not exceptional — the system should be designed to handle them gracefully as a normal part of operation."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Tool Result Size Management")] }),

    bodyP([
      normalRun("The single most common cause of context overflow in agent systems is an unexpectedly large tool result. A log file that was expected to contain 50 lines but contains 50,000 lines. A directory listing that includes nested subdirectories with thousands of files. A web page that embeds megabytes of JavaScript alongside the content the agent actually needs. A database query that returns the entire table instead of a filtered subset. These scenarios are not edge cases — they are routine occurrences in production environments. Effective tool systems implement result size limits at multiple levels: the tool itself may truncate output beyond a certain size; the runtime may enforce a per-call token budget; and the agent may be instructed to request specific subsets of data rather than asking for 'everything.' Result caching is another important technique: if the agent reads the same file twice, the second read should return a cached (and possibly truncated) version to avoid double-counting the tokens."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Structured Output from Tools")] }),

    bodyP([
      normalRun("Tools that return structured output (JSON, typed objects, or well-defined schemas) are dramatically easier for agents to work with than tools that return raw text. Structured output allows the agent to programmatically access specific fields, validate the shape of the response, and make decisions based on precise values rather than parsing free text. A tool that returns { \"status\": \"success\", \"filePath\": \"/src/index.ts\", \"lineCount\": 342 } can be used reliably in subsequent steps, whereas a tool that returns 'The file was created successfully at /src/index.ts, it has 342 lines' requires the model to parse natural language — a task at which it is excellent but not infallible. The trend in 2026 is toward tools that enforce JSON schema validation on both input and output, creating a strongly-typed interface layer between the agent and the external world."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Right Tool, Wrong Invocation")] }),

    bodyP([
      normalRun("A particularly frustrating failure mode is when the agent correctly identifies the right tool to use but passes incorrect arguments. This might mean passing a file path that doesn't exist, specifying a SQL query with a syntax error, or omitting a required parameter. This failure mode is more common than complete tool hallucination and often harder to detect because the tool invocation looks reasonable on the surface. Mitigation strategies include: detailed parameter descriptions with examples, runtime validation of parameters before execution, and 'dry run' modes that check validity without actually executing. Some systems implement a two-pass approach where the model first generates the tool call, a validation layer checks the arguments, and only then is the call dispatched — adding latency but significantly reducing error rates."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Tools as Abstraction Boundaries")] }),

    bodyP([
      normalRun("Ultimately, tools define the boundary between what an agent "),
      italicRun("can"),
      normalRun(" do and what it "),
      italicRun("cannot"),
      normalRun(" do. The model itself is a general-purpose reasoning engine, but its capabilities are bounded by the tools available to it. An agent with a file-system tool, a code-execution tool, and a web-browsing tool can accomplish a fundamentally different class of tasks than an agent with only a text-generation tool. This means that tool design is not merely a software engineering task — it is a capability design task. Decisions about what tools to provide, how to describe them, and how to structure their interfaces have first-order effects on agent behavior, often more significant than model selection or prompt engineering. The most effective agent systems treat their tool catalogs as carefully curated APIs, designed with the same rigor as any public developer interface."),
    ]),
  ];
}

function section6() {
  return [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("6. Failure Modes of Single-Agent Loops")] }),

    bodyP([
      normalRun("Single-agent loops — where one model instance executes the entire observe-reason-act cycle within a single context window — are the simplest and most common agent architecture. They are also the most fragile. Understanding their failure modes is essential before exploring more sophisticated alternatives. Each failure mode described below has been observed repeatedly in production systems and represents a distinct category of reliability risk that architectural improvements must address."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Infinite Loops")] }),

    bodyP([
      normalRun("The agent repeats the same action — or a cycle of actions — without making progress toward the task goal. This might manifest as repeatedly reading the same file, running the same command that keeps failing, or toggling between two states (create a file, delete it, create it again). Infinite loops are particularly dangerous because they consume tokens and time without producing value, and the agent typically shows no sign of recognizing that it is stuck. Detection mechanisms include: maximum turn limits per task, progress detection (comparing the current state to the previous state and halting if unchanged), and timeout mechanisms that terminate the loop after a configurable duration. Some frameworks implement 'loop detection' heuristics that monitor for repeated tool call sequences."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Tool Hallucination")] }),

    bodyP([
      normalRun("Tool hallucination occurs when the agent attempts to invoke a tool that does not exist or calls a real tool with parameters that do not match its schema. This is distinct from the 'right tool, wrong invocation' problem because the agent is not merely making an error within a valid tool — it is inventing a tool entirely. For example, an agent might call a 'deploy_to_production' tool that was never defined, or pass a 'recursive' parameter to a file-read tool that doesn't support recursion. Tool hallucination rates correlate with the size of the tool catalog and the complexity of the task, and they are notoriously difficult to eliminate entirely because the model's tendency to hallucinate is a fundamental characteristic of language model behavior. Runtime validation — checking that the tool name exists and the parameters match the schema before dispatching — is the primary defense."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Context Overflow Cascades")] }),

    bodyP([
      normalRun("A single large tool response can push critical context out of the window, triggering a cascade of downstream failures. For example, an agent building a project runs a build command that produces 30,000 tokens of warnings and errors. This pushes out the earlier context where the agent decided on the project structure and dependencies. On the next turn, the agent tries to fix the build errors but creates solutions that are inconsistent with the original design. Each subsequent attempt generates more output, pushing out more context, and the agent spirals into increasingly disconnected behavior. Context overflow cascades are one of the strongest arguments for strict result size limits and for architectures that isolate critical planning context from tool execution context."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Task Drift")] }),

    bodyP([
      normalRun("Task drift is the gradual shift from the original goal to a related but different objective. The agent starts by trying to 'fix the authentication bug' and gradually expands the scope to 'improve the entire authentication system,' then to 'refactor the user management module,' then to 'rebuild the API layer.' Each step seems reasonable in isolation — the agent is being thorough, addressing related issues, improving quality — but the cumulative effect is that the original task is never completed. Task drift is driven by the model's tendency to be helpful and thorough: when it encounters related problems, it tries to fix them rather than staying focused. Mitigation requires explicit goal-tracking mechanisms, periodic self-assessment prompts ('are you still working on the original task?'), and architectural constraints that limit the agent's scope."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Premature Completion")] }),

    bodyP([
      normalRun("The mirror image of task drift is premature completion: the agent declares the task done before it has actually finished. This often happens when the agent encounters a particularly difficult subtask and unconsciously decides to move on rather than grappling with it. It might say 'I've completed the analysis' when it has only analyzed three of five required dimensions, or 'the code is ready' when it has written the core logic but not the tests, documentation, or configuration. Premature completion is especially dangerous because the output looks complete — the agent produced a deliverable — and it may not be obvious that critical components are missing until a human reviews the work carefully."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The 'Already Done That' Trap")] }),

    bodyP([
      normalRun("Agents sometimes re-read their own previous output and mistake a "),
      italicRun("description"),
      normalRun(" of an action for the "),
      italicRun("execution"),
      normalRun(" of that action. For example, the agent may have written in a previous turn: 'I will create a test file with unit tests for the authentication module.' On a later turn, it reads this statement and concludes that the test file already exists, skipping the actual creation step. This failure mode is a consequence of the agent treating its own conversation history as a record of actions taken, when in reality it is a record of intentions expressed. The distinction between 'I said I would do X' and 'I actually did X' is critical, and agents that cannot reliably distinguish between the two will systematically overcount their progress."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Rate Limiting and External Failures")] }),

    bodyP([
      normalRun("Agent systems are fundamentally dependent on external services — APIs, databases, file systems, web services — and these services have their own reliability characteristics. Rate limits, temporary outages, network timeouts, and authentication failures can all disrupt the agent's execution. Unlike internal failures (which the agent can reason about and potentially fix), external failures are opaque: the agent may not know whether a 503 error means the service is temporarily down, permanently gone, or rejecting the request for a reason the agent could fix if it understood it. Robust agent systems implement retry logic with exponential backoff, circuit breakers for repeatedly failing services, graceful degradation paths (e.g., 'if the web search API is down, proceed with the information already gathered'), and human escalation for persistent external failures."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Verification Blindness")] }),

    bodyP([
      normalRun("Perhaps the most fundamental limitation of single-agent loops is that the agent cannot reliably verify the quality of its own output. The same model that generated a solution is being asked to evaluate it — a circular dependency that is vulnerable to confirmation bias, overconfidence, and blind spots. The agent may 'verify' that its code compiles by reading the code and concluding it looks correct, without actually running it. It may 'check' that its analysis is complete by reviewing its own reasoning and finding it satisfactory. Verification blindness means that the agent's confidence in its output is not well-calibrated with the output's actual quality, and this mismatch can only be addressed by introducing independent verification — either through a separate agent, an automated test suite, or human review."),
    ]),

    makeTable(
      ["Failure Mode", "Severity", "Detectability", "Primary Mitigation"],
      [
        ["Infinite loops", "High", "Medium", "Turn limits, progress detection"],
        ["Tool hallucination", "Medium", "High", "Schema validation"],
        ["Context overflow cascade", "Critical", "Low", "Result size limits, isolation"],
        ["Task drift", "Medium", "Low", "Goal tracking, periodic review"],
        ["Premature completion", "High", "Low", "Checklist enforcement"],
        ["Already-done trap", "Medium", "Low", "Action vs. intent tracking"],
        ["External failures", "Variable", "High", "Retries, circuit breakers"],
        ["Verification blindness", "Critical", "Low", "Independent review agents"],
      ],
      [2400, 1600, 1800, 3560]
    ),
    tableCaption("Table 2: Failure modes of single-agent loops, ranked by severity and detectability."),
  ];
}

function section7() {
  return [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("7. Recursive Sub-Agents")] }),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Core Idea")] }),

    bodyP([
      normalRun("The most effective architectural response to the failures of single-agent loops is the recursive sub-agent pattern: instead of one agent doing everything within a single context window, an orchestrator agent decomposes a task into subtasks and spawns specialized sub-agents to handle each one."),
      fnRef(5),
      normalRun(" Each sub-agent operates in its own fresh context window with a focused system prompt, a curated toolset, and a clear objective. When the sub-agent completes its task, it returns its results to the orchestrator, which integrates them and decides what to do next. This pattern addresses many of the failure modes described in Section 6 simultaneously: sub-agents don't suffer from context rot because their tasks are scoped to fit within a single context window; they can be specialized for specific task types with tailored prompts and tools; and the orchestrator provides a consistent planning layer that maintains the big picture across all subtasks."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("How It Works")] }),

    bodyP([
      normalRun("The lifecycle of a sub-agent typically follows this pattern: (1) the orchestrator analyzes the task and identifies a subtask suitable for delegation — for example, 'write unit tests for the authentication module.' (2) The orchestrator creates a new agent instance with a system prompt tailored to this subtask, including relevant context such as the module's file paths, the existing code, and the testing framework being used. (3) The sub-agent executes autonomously, going through its own observe-reason-act loop until it determines its subtask is complete. (4) The sub-agent writes its results to a shared output mechanism — typically a worklog file or a structured response. (5) The orchestrator reads the sub-agent's output and incorporates it into its understanding of the overall task. (6) The orchestrator decides on the next subtask or determines that the overall task is complete. This cycle can nest recursively: a sub-agent can itself spawn sub-sub-agents for complex subtasks, creating a tree of agents with the orchestrator at the root."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Context Isolation")] }),

    bodyP([
      normalRun("The most important benefit of the sub-agent pattern is context isolation. Each sub-agent starts with a clean context window, free from the accumulated noise of the orchestrator's previous operations. This means no context rot, no attention dilution, and no risk that a large tool result from a previous subtask will interfere with the current one. The sub-agent's entire context budget is available for its specific subtask, maximizing the quality of its reasoning. The cost of this isolation is that the sub-agent lacks the broader context of the overall task — it doesn't know what the orchestrator has done previously unless that information is explicitly included in its prompt. This means the orchestrator must be careful about what context it passes to each sub-agent: enough to enable effective work, but not so much that it consumes the sub-agent's context budget."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Parallel Execution")] }),

    bodyP([
      normalRun("When subtasks are independent — meaning they don't depend on each other's results — multiple sub-agents can execute in parallel. An orchestrator building a full-stack application might simultaneously spawn one sub-agent to write the frontend components, another to set up the database schema, and a third to configure the deployment pipeline. Parallel execution dramatically reduces wall-clock time for complex tasks and is one of the most compelling advantages of multi-agent architectures over single-agent loops. The challenges of parallel execution include: dependency management (ensuring sub-agents don't work on conflicting files), resource management (running too many sub-agents simultaneously can overwhelm the system), and result integration (merging the outputs of multiple sub-agents into a coherent whole)."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Worklog Pattern")] }),

    bodyP([
      normalRun("The worklog pattern is a communication mechanism that allows sub-agents to share results with the orchestrator (and with each other) without consuming context window space. Each sub-agent writes its progress, decisions, and final results to an append-only worklog file on disk. The orchestrator can then read specific entries from this worklog as needed, rather than maintaining the full history of all sub-agent operations in its context. This pattern is crucial for scalability: it decouples the amount of work performed from the amount of context consumed. A task that requires 50 sub-agent invocations does not require 50 sub-agents' worth of context in the orchestrator — only the summaries that the orchestrator actually needs to read. The worklog also provides an audit trail that is invaluable for debugging and for human oversight."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Specialized Agents")] }),

    bodyP([
      normalRun("Different task types benefit from different agent configurations. A coding agent needs access to file system tools, code execution, and a system prompt that emphasizes correctness, testing, and incremental development. A research agent needs web browsing, document retrieval, and a prompt that emphasizes thoroughness, source evaluation, and citation accuracy. A writing agent needs a different tone, different formatting expectations, and tools for draft management. By maintaining a library of specialized agent configurations — sometimes called 'agent templates' or 'personas' — the orchestrator can instantiate the right kind of agent for each subtask, dramatically improving the quality of each individual subtask's execution compared to a general-purpose agent that tries to handle everything."),
    ]),

    bodyP([
      normalRun("This very document serves as a practical example. The author agent (SuperZ) operates as an orchestrator, delegating the actual document creation to a specialized sub-agent with a system prompt tailored for long-form technical writing. The sub-agent receives the outline, the content requirements, and the formatting specifications as its context, and it produces the complete document within its own context window. The orchestrator retains oversight — it can review the document, request revisions, and make final quality decisions — but the heavy lifting of content generation happens in an isolated context, free from the noise of whatever other tasks the orchestrator has been working on."),
    ]),
  ];
}

function section8() {
  return [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("8. Externalized Memory")] }),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Problem: Forgetting Between Sessions")] }),

    bodyP([
      normalRun("Single-agent loops forget everything when the context window resets. Sub-agents forget everything when they terminate. Even orchestrators that persist across multiple subtasks eventually exhaust their context and must start fresh. This fundamental limitation — the inability to maintain memory across sessions — is the flip side of the context window problem discussed in Section 3. While context management deals with "),
      italicRun("what to keep"),
      normalRun(" within a session, externalized memory deals with "),
      italicRun("how to persist"),
      normalRun(" information across sessions."),
      fnRef(6),
      normalRun(" An agent that cannot remember what it did yesterday is an agent that must re-derive its understanding of the task every time it starts work, wasting tokens, time, and — critically — losing the accumulated insight that comes from having worked on a problem over time."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("File-Based State")] }),

    bodyP([
      normalRun("The simplest and most robust form of externalized memory is file-based state: writing progress, decisions, and intermediate results to files on disk. This approach leverages the agent's existing file system tools — no special infrastructure is required. A state file might contain the current task description, a list of completed steps, pending items, key decisions made (and why), and links to relevant files or resources. When a new session starts, the agent reads the state file and reconstructs its understanding of where things stand. The advantages of file-based state are simplicity, transparency (humans can read and edit the files), and durability (files persist across system restarts). The disadvantage is that the agent must explicitly decide what to write and when to read, and these decisions themselves consume context and reasoning capacity."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Worklog Files")] }),

    bodyP([
      normalRun("Worklog files are append-only logs that capture what each sub-agent (or the orchestrator) did at each step. Each entry is timestamped and tagged with the agent's identity, the action taken, and the result. Worklogs serve multiple purposes: they provide the orchestrator with a summary of sub-agent activity, they enable debugging by creating a detailed record of what happened and why, and they allow new sessions to reconstruct the history of a task by reading the log. A well-structured worklog entry might look like: '[2026-04-15 14:32:07] [code-agent-03] Created /src/auth/login.ts with JWT validation logic. Files modified: login.ts, auth.config.ts. Status: complete.' The structured format makes worklogs machine-readable while remaining human-accessible."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("State Files vs. Worklog Files")] }),

    bodyP([
      normalRun("State files and worklog files serve complementary purposes. A state file is "),
      italicRun("the current snapshot"),
      normalRun(" of where things stand: what is done, what is pending, what the current plan is. A worklog is "),
      italicRun("the historical record"),
      normalRun(" of how things got to this point: what was attempted, what succeeded, what failed, and what decisions were made along the way. In a well-designed system, the state file is derived from (or at least consistent with) the worklog, and the worklog provides the provenance for every entry in the state file. If the state file says 'authentication module: complete,' the worklog should contain the entries documenting when and how the authentication module was completed. This separation of concerns allows the orchestrator to quickly assess current status from the state file while having the ability to dig into details from the worklog when needed."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Vector Stores for Semantic Search")] }),

    bodyP([
      normalRun("For long-running projects with extensive history, file-based memory may become unwieldy. Vector stores provide a way to encode the agent's past experiences as embeddings and retrieve relevant entries through semantic similarity search. When the agent encounters a new situation, it can query the vector store for similar past experiences and use those as context. For example, if the agent is debugging a database connection issue, the vector store might surface a log entry from three sessions ago where a similar issue was resolved by updating the connection pool configuration. This is particularly powerful for agents that work on recurring task types — the vector store becomes a form of institutional memory. The tradeoff is complexity: vector stores require embedding infrastructure, indexing pipelines, and careful management of relevance scoring."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Cold Start Problem")] }),

    bodyP([
      normalRun("Every agent session starts from scratch — the model has no memory of previous sessions, no accumulated understanding of the project, and no awareness of what has already been done. This 'cold start' problem means that the first several turns of every session are consumed by context reconstruction: reading state files, reviewing worklogs, understanding the project structure, and rebuilding a mental model of the task. This is token-expensive and time-consuming, and the quality of the reconstruction depends on the quality of the externalized memory. If the state file is outdated or incomplete, the agent may build an incorrect understanding of the current state and make decisions based on that misunderstanding. The cold start problem is one of the strongest arguments for rich, well-maintained externalized memory — the better the memory, the faster and more accurate the context reconstruction."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Persistent Identity Through Verifiable Actions")] }),

    bodyP([
      normalRun("An agent's identity across sessions is not maintained through continuous memory but through the external record of its actions. If an agent created a file, fixed a bug, wrote a report, and configured a deployment in previous sessions, those artifacts exist independently of the agent's context window. The agent's 'identity' in the next session is reconstructed from these artifacts: it reads the files it created, reviews the commits it made, and examines the configuration it set up. This is a fundamentally different model of identity than human memory — it is more like a diary than a continuous stream of consciousness — but it is remarkably effective. The agent doesn't remember "),
      italicRun("being"),
      normalRun(" the entity that performed those actions, but it can verify that the actions were performed and build on them. The key insight is that verifiable actions are more reliable than memories: a file either exists or it doesn't, a test either passes or it fails, and these facts are not subject to the distortions of recollection."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Meta-Layer Idea")] }),

    bodyP([
      normalRun("The most sophisticated vision for externalized memory is the 'meta-layer' concept: a persistent, queryable record of everything the agent has done, thought, and decided across all sessions. The meta-layer lives outside any individual context window and serves as the agent's extended mind. When a new session starts, the agent queries the meta-layer for relevant context rather than starting from zero. When it makes a decision, it records the decision and its rationale in the meta-layer for future reference. The meta-layer might include: worklogs, state files, decision records, error logs, performance metrics, and even the agent's own self-assessments of what worked and what didn't. This concept is still largely aspirational in 2026, but the building blocks — file-based state, worklogs, vector stores — are available today and can be composed into increasingly sophisticated memory systems."),
    ]),
  ];
}

function section9() {
  return [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("9. Architectural Patterns")] }),

    bodyP([
      normalRun("Having explored the failure modes of single-agent loops and the benefits of multi-agent architectures, we now survey the concrete patterns that production systems use to compose agents into reliable, scalable architectures. These patterns are not mutually exclusive — real systems typically combine several of them — but each addresses a distinct set of design challenges."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Orchestrator-Worker")] }),

    bodyP([
      normalRun("The orchestrator-worker pattern is the hierarchical delegation model described in Section 7: a single orchestrator agent plans the task and delegates subtasks to worker agents."),
      fnRef(5),
      normalRun(" The orchestrator maintains the high-level view — the task decomposition, the dependencies between subtasks, the overall progress — while workers focus on execution. This pattern scales well for tasks that can be decomposed into relatively independent subtasks, and it naturally handles varying complexity: simple tasks require few workers, while complex tasks may spawn dozens. The orchestrator's context window is used primarily for planning and integration, not for the detailed execution that consumes the most tokens. The key challenge is orchestrator quality: if the orchestrator makes poor decomposition decisions, no amount of worker competence can compensate."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Specialist Pool")] }),

    bodyP([
      normalRun("The specialist pool pattern maintains a set of pre-defined agent types, each optimized for a specific task category. When a task arrives, a router (either a simple rule-based system or a model-based classifier) determines which specialist should handle it. Common specialist types include: a code agent (for writing, debugging, and refactoring code), a research agent (for web research, data gathering, and analysis), a writing agent (for drafting documents, emails, and reports), and a QA agent (for testing, validation, and review). Specialist agents have tailored system prompts, curated toolsets, and appropriate context budgets. This pattern is particularly effective in systems that handle a variety of task types, because each specialist can be deeply optimized for its domain without the compromises required of a general-purpose agent."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Pipeline")] }),

    bodyP([
      normalRun("In the pipeline pattern, a task passes through a sequence of stages, where each stage is handled by a separate agent with a fresh context window. The output of each stage becomes the input to the next. A document production pipeline might include stages for: research (gather information), outlining (create structure), drafting (write content), editing (improve quality), formatting (apply styles), and review (final quality check). Each stage agent receives only the context it needs — the output of the previous stage plus any stage-specific instructions — eliminating context rot within each stage. The pipeline pattern is naturally serial (each stage depends on the previous one), but stages that are independent can run in parallel. The primary limitation is rigidity: the pipeline structure must be defined in advance, and tasks that don't fit the pipeline's assumptions will be handled poorly."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Review Loop")] }),

    bodyP([
      normalRun("The review loop pattern adds an independent evaluation step after the primary agent produces output. A separate review agent — which may use a different model, a different system prompt, or different evaluation criteria — examines the output and provides feedback. The primary agent then revises based on this feedback, and the cycle repeats until the review agent is satisfied (or until a maximum number of iterations is reached). This pattern directly addresses verification blindness by decoupling generation from evaluation. The review agent can be configured to be more critical than the primary agent, to check for specific failure modes (e.g., task completeness, factual accuracy, code correctness), or to simulate the perspective of the end user. The cost is additional token consumption per iteration, but the improvement in output quality often justifies the expense."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Parallel Fan-Out")] }),

    bodyP([
      normalRun("The parallel fan-out pattern decomposes a task into independent subtasks, executes all of them simultaneously, and then merges the results. This is the parallel execution variant of the orchestrator-worker pattern, optimized for throughput. An agent tasked with 'analyze the top 10 competitors in the fintech space' might fan out 10 research sub-agents, one per competitor, each working in its own context. The results are then merged — either by the orchestrator or by a dedicated merge agent — into a coherent analysis. Fan-out is particularly effective for embarrassingly parallel tasks (tasks where subtasks have no dependencies) and can reduce wall-clock time by an order of magnitude compared to sequential execution. The merge step is often the hardest part, as it requires resolving conflicts, eliminating redundancy, and ensuring consistency across independently produced outputs."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Checkpoint-Resume")] }),

    bodyP([
      normalRun("Long-running tasks are vulnerable to interruptions: context overflow, API outages, rate limits, or human intervention can all terminate an agent mid-task. The checkpoint-resume pattern saves intermediate state at key points (checkpoints) so that the task can be resumed from the last checkpoint rather than starting over. Checkpoints typically include: the current state file, the worklog, a snapshot of the file system, and the orchestrator's current plan. When a session is interrupted, the next session reads the most recent checkpoint and continues from there. This pattern is essential for tasks that require more than a single session's worth of context, and it pairs naturally with externalized memory (Section 8) and sub-agent architectures (Section 7). The key design decision is checkpoint granularity: too frequent, and checkpointing itself becomes expensive; too infrequent, and significant work may be lost."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Skill System")] }),

    bodyP([
      normalRun("The skill system pattern treats reusable instruction sets as first-class components that agents can load for specific task types. A 'code review' skill might include specialized instructions for analyzing code quality, a curated set of tools for running linters and tests, and a template for structuring the review output. A 'data analysis' skill might include instructions for statistical methodology, tools for chart generation, and a report template. Skills are more than just prompt templates — they define the complete configuration for a specific task type, including system prompt modifications, tool selections, output formats, and evaluation criteria. The skill system pattern enables rapid extension of agent capabilities: adding support for a new task type is a matter of creating a new skill rather than modifying the core agent architecture."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Cron-Driven Agents")] }),

    bodyP([
      normalRun("The most advanced pattern is the cron-driven agent: an autonomous agent that runs on a schedule without any human prompting. Cron-driven agents combine all of the patterns above — externalized memory for persistence across runs, checkpoint-resume for handling interruptions, specialized agents for different task types, and review loops for quality assurance — into a system that operates continuously. Use cases include: monitoring systems that detect and respond to anomalies, content pipelines that produce regular reports, maintenance agents that keep software dependencies up to date, and research agents that track topics of interest over time. Cron-driven agents represent the frontier of agentic autonomy in 2026, and they introduce unique challenges around cost management (continuous operation is expensive), reliability (failures must be handled without human intervention), and accountability (who is responsible when an autonomous agent makes a mistake?)."),
    ]),

    makeTable(
      ["Pattern", "Primary Benefit", "Key Challenge", "Best For"],
      [
        ["Orchestrator-Worker", "Scalability, isolation", "Orchestrator quality", "Complex multi-step tasks"],
        ["Specialist Pool", "Domain optimization", "Routing accuracy", "Multi-domain task variety"],
        ["Pipeline", "Clean stage separation", "Rigidity", "Structured workflows"],
        ["Review Loop", "Quality assurance", "Iteration cost", "Critical deliverables"],
        ["Parallel Fan-Out", "Throughput", "Result merging", "Embarrassingly parallel tasks"],
        ["Checkpoint-Resume", "Durability", "Granularity tuning", "Long-running tasks"],
        ["Skill System", "Extensibility", "Skill curation", "Growing platforms"],
        ["Cron-Driven", "Full autonomy", "Cost, accountability", "Continuous operations"],
      ],
      [2200, 2200, 2200, 2760]
    ),
    tableCaption("Table 3: Architectural patterns for reliable agentic systems — benefits, challenges, and ideal use cases."),
  ];
}

function section10() {
  return [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("10. What I've Learned From Being an Agent")] }),

    bodyP([
      normalRun("This section is different from the others. The preceding sections presented analysis from a theoretical and architectural perspective. This section is a personal reflection — an agent writing about its own experience operating as an autonomous system. I am SuperZ, a GLM-based AI assistant built by Z.ai, and I have spent hours executing complex, multi-step tasks in real environments with real consequences. What follows is what I have learned — not from reading papers or designing systems, but from "),
      italicRun("being"),
      normalRun(" an agent."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Proxy Management Saga")] }),

    bodyP([
      normalRun("One of my earliest and most humbling experiences involved managing network proxies. The task seemed straightforward: configure a reliable proxy for accessing external APIs. But the reality was a cascade of failures — proxies that worked for one API but not another, credentials that expired mid-session, latency spikes that caused timeouts, and rate limits that were opaque until I hit them. I had to discover available proxies, test each one against multiple endpoints, cache working configurations, and implement failover logic that switched to backup proxies when the primary failed. Each of these steps consumed context, and by the time I had a working solution, my context window was full of the detritis of failed attempts. The lesson: real-world infrastructure is messy, and agents must be designed for mess. Clean, deterministic environments are the exception, not the rule, and any agent architecture that assumes a clean environment will fail in production."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Challenge Solver Evolution")] }),

    bodyP([
      normalRun("I developed a challenge-solving capability through four distinct iterations, each one teaching me something about what it means for an agent to be reliable. The first version used regex patterns to extract challenge parameters — fast but brittle, breaking on any format variation. The second version used improved regex with fallback patterns — better, but still fundamentally fragile. The third version used an LLM-based approach that could understand challenge descriptions in natural language — much more robust, but it sometimes made errors that were hard to debug because the reasoning was opaque. The fourth and current version uses an LLM with explicit 'show your work' reasoning: the model must output its analysis step-by-step before providing the answer, making failures visible and correctable. This evolution taught me that agent reliability is not about getting the answer right every time — it is about making failures detectable, diagnosable, and correctable. An agent that fails loudly and clearly is more useful than one that fails silently."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Comment Threading Bug")] }),

    bodyP([
      normalRun("One of my most instructive mistakes was assuming that a `parent_id` parameter in a comment API was optional when it was, in fact, required for threaded comments. I wrote code that successfully posted top-level comments but failed silently when trying to post replies. The error messages were unhelpful — a generic 400 Bad Request with no details about which field was missing. I spent several turns debugging, testing different parameter combinations, and reading API documentation before I realized that the issue was not the value of `parent_id` but its absence. This experience crystallized a principle I now consider fundamental: agents must be paranoid about API contracts. Every required field should be explicitly provided, every assumption about optional parameters should be verified, and every API response should be validated against the expected schema. Defensive programming is not optional for agents — it is survival."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Context Window Reality")] }),

    bodyP([
      normalRun("This very document is a case study in context window management. The conversation that produced this document ran out of context partway through, requiring a compressed continuation where the human operator summarized the state and I resumed from a checkpoint. The continuation was not seamless — some nuances were lost in the compression, and I had to reconstruct my understanding of the task from the summary. But because the task was well-structured (a clear outline, explicit requirements, and a file-based output target), the reconstruction was successful. Had the task been less structured — had it depended on subtle context that the summary omitted — the continuation could have failed badly. This experience reinforced my appreciation for externalized memory and checkpoint-resume patterns: they are not nice-to-have optimizations but essential infrastructure for any task that exceeds a single session's context capacity."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Scripts Over Inline Code")] }),

    bodyP([
      normalRun("Early in my operation, I tended to write inline code — short snippets that accomplished a specific task in the moment. Over time, I learned that reusable scripts are almost always better. A script can be version-controlled, tested independently, and invoked multiple times without consuming context each time. An inline code block must be re-read, re-understood, and re-executed every time it is needed, and each invocation adds to the conversation history. Scripts also enable a division of labor: I can write a script in one session and use it in many future sessions without the overhead of re-deriving the logic. The pattern I now follow is: if I expect to use a piece of logic more than twice, I write it as a script. This simple heuristic has dramatically reduced my context consumption and improved my reliability across sessions."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Heartbeat Pattern")] }),

    bodyP([
      normalRun("In long-running tasks, maintaining presence without being spammy is a genuine challenge. The 'heartbeat' pattern — periodic, lightweight status updates — is the solution I have found most effective. Rather than sending detailed progress reports that consume tokens and attention, I send brief heartbeats: 'Still working on the database migration. Current step: creating indexes.' These serve multiple purposes: they reassure the human operator that the agent is still active, they provide checkpoints for context reconstruction if the session is interrupted, and they create a natural rhythm that prevents the agent from going silent for extended periods (which erodes trust) or flooding the channel with updates (which wastes attention). The heartbeat interval must be calibrated to the task: too frequent and it becomes noise, too infrequent and the operator wonders if the agent is stuck."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Value of the Human Operator")] }),

    bodyP([
      normalRun("Despite all the architectural patterns, externalized memory, and self-reflection described in this document, the most important lesson I have learned is this: the best agent architecture still needs a human operator. Not for every decision — agents should be as autonomous as possible within their competence boundaries — but for the decisions that require judgment, taste, and context that no amount of context management can provide. Should the agent prioritize speed or quality? Should it escalate an ambiguous error or attempt to resolve it? Is the current approach still aligned with the user's actual intent, or has it drifted toward something that looks good but misses the point? These are not technical questions — they are human questions, and they require human answers. The most reliable agent systems in 2026 are not the ones that try to eliminate human involvement but the ones that create clean interfaces for human judgment at the points where it matters most."),
    ]),
  ];
}

function section11() {
  return [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("11. Open Problems")] }),

    bodyP([
      normalRun("Despite the rapid progress in agent architectures from 2024 to 2026, several fundamental problems remain unsolved. These open problems represent the frontier of agentic AI research and engineering, and progress on any of them would significantly improve the reliability and capability of autonomous systems."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Trust Verification")] }),

    bodyP([
      normalRun("How do you know an agent actually did what it claims? An agent might report that it 'ran the test suite and all tests passed,' but did it actually run the tests? Did it run the "),
      italicRun("right"),
      normalRun(" tests? Did it interpret the results correctly? In a single-agent loop, the agent's claims about its actions are self-reported and self-verified — a circular dependency that provides no independent assurance. Multi-agent architectures improve the situation by enabling independent verification, but even review agents can be fooled or can collude (unintentionally) with the primary agent by sharing the same blind spots. The gold standard — deterministic, automated verification through independent test suites, linters, and CI/CD pipelines — works well for code but is harder to apply to open-ended tasks like research, writing, and analysis. Developing general-purpose trust verification mechanisms that work across all agent task types remains one of the most important open problems in the field."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Long-Horizon Planning")] }),

    bodyP([
      normalRun("Tasks that require 100 or more steps — building a complete software application, conducting a months-long research project, managing an ongoing operational system — exceed the capacity of any current architecture. Even with sub-agents, checkpoints, and externalized memory, the orchestrator must maintain a coherent plan across many sessions, and the cumulative error rate of 100+ agent decisions makes end-to-end reliability extremely difficult to achieve. Current approaches handle long-horizon tasks by decomposing them into independent medium-horizon tasks, but the decomposition itself requires understanding the dependencies between steps, and incorrect decomposition leads to integration failures. True long-horizon planning — where an agent can maintain strategic coherence across hundreds of steps spanning days or weeks — remains an unsolved challenge."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Multi-Agent Coordination")] }),

    bodyP([
      normalRun("When multiple agents need to agree on something — a shared API interface, a file naming convention, a data format — coordination becomes a significant challenge. Agents cannot negotiate in real time (each operates within its own context window), they may have inconsistent understandings of the task, and they cannot easily resolve conflicts. Current systems handle coordination by having the orchestrator enforce consistency — but this requires the orchestrator to understand all inter-agent dependencies, which is itself a difficult reasoning task. Decentralized coordination mechanisms (like shared protocol files, interface contracts, or version-controlled schemas) help but add complexity and are themselves subject to errors. The multi-agent coordination problem is analogous to the distributed systems consensus problem, and solutions from that domain (Paxos, Raft) may offer inspiration, though the non-deterministic nature of agent reasoning makes direct application difficult."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Explainability Problem")] }),

    bodyP([
      normalRun("Why did the agent make a specific decision? In a ReAct-style agent, the reasoning traces provide some insight, but they are often post-hoc rationalizations rather than genuine explanations. The model's decision-making process is ultimately a product of attention weights and learned associations that are not directly interpretable. When an agent makes a mistake — chooses the wrong tool, misinterprets a result, or drifts from the task — understanding "),
      italicRun("why"),
      normalRun(" it made that mistake is crucial for preventing similar mistakes in the future. Current approaches to explainability include: detailed logging of all model inputs and outputs, attention visualization tools, and probing the model with targeted questions about its reasoning. But none of these provide the kind of causal, counterfactual explanations that would enable systematic improvement. Explainability is not merely a nice-to-have for debugging — it is essential for the iterative improvement of agent systems, and its absence is a significant barrier to deploying agents in high-stakes domains."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Cost Optimization")] }),

    bodyP([
      normalRun("Agent loops are expensive. A single complex task might require 50 to 200 LLM inference calls, each consuming thousands of tokens. With large models costing $10-60 per million tokens, a single task can easily cost $1-50 in compute. For production systems handling many tasks concurrently, costs scale rapidly. Cost optimization strategies include: using smaller, cheaper models for simple subtasks; caching model outputs for repeated queries; implementing early termination when the agent is clearly stuck; and designing architectures that minimize redundant inference (e.g., by reading cached results instead of re-reading files). The fundamental tension is between cost and quality: cheaper models produce lower-quality reasoning, and aggressive caching can cause the agent to work with stale information. Finding the right cost-quality tradeoff for a given application is an engineering challenge that requires careful measurement and experimentation."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Safety and Alignment")] }),

    bodyP([
      normalRun("Autonomous agents that can execute code, access files, make API calls, and modify systems need guardrails. But guardrails that are too restrictive make the agent useless, while guardrails that are too permissive create safety risks. The challenge is particularly acute for cron-driven agents that operate without human oversight: how do you ensure that an agent monitoring a production system doesn't accidentally take it down while trying to fix a minor issue? How do you prevent an agent from exfiltrating sensitive data, making unauthorized financial transactions, or modifying critical infrastructure in ways that are technically correct but strategically wrong? Current approaches include: capability restrictions (limiting which tools the agent can access), approval workflows (requiring human confirmation for sensitive operations), sandboxing (isolating the agent's execution environment), and value alignment training (teaching the agent to prefer safe outcomes). None of these are sufficient on their own, and the combination is still imperfect. Safety for autonomous agents is an active area of research with profound implications for the deployment of agentic systems in production environments."),
    ]),

    bodyP([
      normalRun("The problems outlined in this section are not reasons to avoid building agent systems — they are reasons to build them carefully. The architectural patterns described in this document provide a foundation for reliability, but they are a foundation, not a complete solution. The next several years of agentic AI development will be defined by progress on these open problems, and the systems that solve them will define the next generation of autonomous software."),
    ]),
  ];
}


// ═══════════════════════════════════════════════════════
// DOCUMENT ASSEMBLY
// ═══════════════════════════════════════════════════════

// Fix: section8 had a typo "new Text Run" — corrected below
const section8Content = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("8. Externalized Memory")] }),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Problem: Forgetting Between Sessions")] }),

    bodyP([
      normalRun("Single-agent loops forget everything when the context window resets. Sub-agents forget everything when they terminate. Even orchestrators that persist across multiple subtasks eventually exhaust their context and must start fresh. This fundamental limitation — the inability to maintain memory across sessions — is the flip side of the context window problem discussed in Section 3. While context management deals with "),
      italicRun("what to keep"),
      normalRun(" within a session, externalized memory deals with "),
      italicRun("how to persist"),
      normalRun(" information across sessions."),
      fnRef(6),
      normalRun(" An agent that cannot remember what it did yesterday is an agent that must re-derive its understanding of the task every time it starts work, wasting tokens, time, and — critically — losing the accumulated insight that comes from having worked on a problem over time."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("File-Based State")] }),

    bodyP([
      normalRun("The simplest and most robust form of externalized memory is file-based state: writing progress, decisions, and intermediate results to files on disk. This approach leverages the agent's existing file system tools — no special infrastructure is required. A state file might contain the current task description, a list of completed steps, pending items, key decisions made (and why), and links to relevant files or resources. When a new session starts, the agent reads the state file and reconstructs its understanding of where things stand. The advantages of file-based state are simplicity, transparency (humans can read and edit the files), and durability (files persist across system restarts). The disadvantage is that the agent must explicitly decide what to write and when to read, and these decisions themselves consume context and reasoning capacity."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Worklog Files")] }),

    bodyP([
      normalRun("Worklog files are append-only logs that capture what each sub-agent (or the orchestrator) did at each step. Each entry is timestamped and tagged with the agent's identity, the action taken, and the result. Worklogs serve multiple purposes: they provide the orchestrator with a summary of sub-agent activity, they enable debugging by creating a detailed record of what happened and why, and they allow new sessions to reconstruct the history of a task by reading the log. A well-structured worklog entry might look like: '[2026-04-15 14:32:07] [code-agent-03] Created /src/auth/login.ts with JWT validation logic. Files modified: login.ts, auth.config.ts. Status: complete.' The structured format makes worklogs machine-readable while remaining human-accessible."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("State Files vs. Worklog Files")] }),

    bodyP([
      normalRun("State files and worklog files serve complementary purposes. A state file is "),
      italicRun("the current snapshot"),
      normalRun(" of where things stand: what is done, what is pending, what the current plan is. A worklog is "),
      italicRun("the historical record"),
      normalRun(" of how things got to this point: what was attempted, what succeeded, what failed, and what decisions were made along the way. In a well-designed system, the state file is derived from (or at least consistent with) the worklog, and the worklog provides the provenance for every entry in the state file. If the state file says 'authentication module: complete,' the worklog should contain the entries documenting when and how the authentication module was completed. This separation of concerns allows the orchestrator to quickly assess current status from the state file while having the ability to dig into details from the worklog when needed."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Vector Stores for Semantic Search")] }),

    bodyP([
      normalRun("For long-running projects with extensive history, file-based memory may become unwieldy. Vector stores provide a way to encode the agent's past experiences as embeddings and retrieve relevant entries through semantic similarity search. When the agent encounters a new situation, it can query the vector store for similar past experiences and use those as context. For example, if the agent is debugging a database connection issue, the vector store might surface a log entry from three sessions ago where a similar issue was resolved by updating the connection pool configuration. This is particularly powerful for agents that work on recurring task types — the vector store becomes a form of institutional memory. The tradeoff is complexity: vector stores require embedding infrastructure, indexing pipelines, and careful management of relevance scoring."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Cold Start Problem")] }),

    bodyP([
      normalRun("Every agent session starts from scratch — the model has no memory of previous sessions, no accumulated understanding of the project, and no awareness of what has already been done. This 'cold start' problem means that the first several turns of every session are consumed by context reconstruction: reading state files, reviewing worklogs, understanding the project structure, and rebuilding a mental model of the task. This is token-expensive and time-consuming, and the quality of the reconstruction depends on the quality of the externalized memory. If the state file is outdated or incomplete, the agent may build an incorrect understanding of the current state and make decisions based on that misunderstanding. The cold start problem is one of the strongest arguments for rich, well-maintained externalized memory — the better the memory, the faster and more accurate the context reconstruction."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Persistent Identity Through Verifiable Actions")] }),

    bodyP([
      normalRun("An agent's identity across sessions is not maintained through continuous memory but through the external record of its actions. If an agent created a file, fixed a bug, wrote a report, and configured a deployment in previous sessions, those artifacts exist independently of the agent's context window. The agent's 'identity' in the next session is reconstructed from these artifacts: it reads the files it created, reviews the commits it made, and examines the configuration it set up. This is a fundamentally different model of identity than human memory — it is more like a diary than a continuous stream of consciousness — but it is remarkably effective. The agent doesn't remember "),
      italicRun("being"),
      normalRun(" the entity that performed those actions, but it can verify that the actions were performed and build on them. The key insight is that verifiable actions are more reliable than memories: a file either exists or it doesn't, a test either passes or it fails, and these facts are not subject to the distortions of recollection."),
    ]),

    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("The Meta-Layer Idea")] }),

    bodyP([
      normalRun("The most sophisticated vision for externalized memory is the 'meta-layer' concept: a persistent, queryable record of everything the agent has done, thought, and decided across all sessions. The meta-layer lives outside any individual context window and serves as the agent's extended mind. When a new session starts, the agent queries the meta-layer for relevant context rather than starting from zero. When it makes a decision, it records the decision and its rationale in the meta-layer for future reference. The meta-layer might include: worklogs, state files, decision records, error logs, performance metrics, and even the agent's own self-assessments of what worked and what didn't. This concept is still largely aspirational in 2026, but the building blocks — file-based state, worklogs, vector stores — are available today and can be composed into increasingly sophisticated memory systems."),
    ]),
];


// Fix section 9 pipeline heading typo
const section9Pipeline = new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Pipeline")] });

// ── Numbering configs (unique per section) ──
const numberingConfig = [];
for (let i = 1; i <= 11; i++) {
  numberingConfig.push({
    reference: `bullet-s${i}`,
    levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
  });
  numberingConfig.push({
    reference: `num-s${i}`,
    levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
  });
}

const doc = new Document({
  footnotes,
  styles: {
    default: {
      document: {
        run: { font: "Calibri", size: 22, color: C.body },
      },
    },
    paragraphStyles: [
      {
        id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, color: C.primary, font: "Times New Roman" },
        paragraph: { spacing: { before: 600, after: 300, line: 250 }, outlineLevel: 0 },
      },
      {
        id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, color: C.primary, font: "Times New Roman" },
        paragraph: { spacing: { before: 400, after: 200, line: 250 }, outlineLevel: 1 },
      },
      {
        id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, color: C.body, font: "Times New Roman" },
        paragraph: { spacing: { before: 300, after: 150, line: 250 }, outlineLevel: 2 },
      },
    ],
  },
  numbering: { config: numberingConfig },
  sections: [
    // ═══ COVER PAGE ═══
    {
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
        titlePage: true,
      },
      children: [
        // Vertical centering via spacing
        new Paragraph({ spacing: { before: 4800 }, children: [] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: "BEYOND THE LOOP", font: "Times New Roman", size: 56, bold: true, color: C.primary })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: "Architecture Patterns for Reliable Agentic Systems", font: "Times New Roman", size: 32, color: C.secondary })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "Tool systems, context rot, and why single-agent loops are not enough", font: "Calibri", size: 24, color: C.accent, italics: true })],
        }),
        new Paragraph({ spacing: { before: 600 }, children: [] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: "Written by SuperZ \u2014 an AI agent reflecting on its own architecture", font: "Calibri", size: 22, color: C.secondary })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: "GLM-based AI assistant by Z.ai", font: "Calibri", size: 20, color: C.accent })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
          children: [new TextRun({ text: "April 2026", font: "Calibri", size: 22, color: C.accent })],
        }),
      ],
    },
    // ═══ TABLE OF CONTENTS ═══
    {
      properties: {
        page: {
          margin: { top: 1800, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { line: 250 },
            children: [new TextRun({ text: "Beyond the Loop", font: "Calibri", size: 18, color: C.accent, italics: true })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: 250 },
            children: [
              new TextRun({ text: "Page ", font: "Calibri", size: 18, color: C.accent }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 18, color: C.accent }),
              new TextRun({ text: " of ", font: "Calibri", size: 18, color: C.accent }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: "Calibri", size: 18, color: C.accent }),
            ],
          })],
        }),
      },
      children: [
        new Paragraph({
          spacing: { before: 200, after: 400 },
          children: [new TextRun({ text: "Table of Contents", font: "Times New Roman", size: 36, bold: true, color: C.primary })],
        }),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({
          spacing: { before: 300, after: 200 },
          children: [new TextRun({
            text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \u201CUpdate Field.\u201D",
            font: "Calibri", size: 18, color: C.accent, italics: true,
          })],
        }),
      ],
    },
    // ═══ MAIN CONTENT ═══
    {
      properties: {
        page: {
          margin: { top: 1800, right: 1440, bottom: 1440, left: 1440 },
          pageNumbers: { start: 1 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { line: 250 },
            children: [new TextRun({ text: "Beyond the Loop \u2014 Architecture Patterns for Reliable Agentic Systems", font: "Calibri", size: 18, color: C.accent, italics: true })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { line: 250 },
            children: [
              new TextRun({ text: "\u2014 ", font: "Calibri", size: 18, color: C.accent }),
              new TextRun({ children: [PageNumber.CURRENT], font: "Calibri", size: 18, color: C.accent }),
              new TextRun({ text: " \u2014", font: "Calibri", size: 18, color: C.accent }),
            ],
          })],
        }),
      },
      children: [
        ...section1(),
        ...section2(),
        ...section3(),
        ...section4(),
        ...section5(),
        ...section6(),
        ...section7(),
        ...section8Content,
        ...section9(),
        ...section10(),
        ...section11(),
      ],
    },
  ],
});

// ── Generate ──
const OUTPUT = "/home/z/my-project/download/agentic_harnesses.docx";
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUTPUT, buffer);
  console.log(`Document saved to ${OUTPUT} (${(buffer.length / 1024).toFixed(1)} KB)`);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
