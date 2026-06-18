import os
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

OUT = "MedRAG_India_Architecture_Analysis.pdf"

# Color Palette
C_PRIMARY = colors.HexColor("#0F172A")    # Dark Slate
C_SECONDARY = colors.HexColor("#0F766E")  # Teal
C_TEXT = colors.HexColor("#334155")       # Charcoal
C_LIGHT_BG = colors.HexColor("#F8FAFC")   # Soft gray
C_BORDER = colors.HexColor("#E2E8F0")     # Border gray
C_ALERT_BG = colors.HexColor("#FFF1F2")   # Light pink-red for alert
C_ALERT_BORDER = colors.HexColor("#FDA4AF") # Red border
C_FLOW_BG = colors.HexColor("#ECFDF5")    # Light green for flow diagrams

def page_frame(canvas, doc):
    canvas.saveState()
    w, h = A4
    
    # Top Header Band
    canvas.setFillColor(colors.HexColor("#0F766E"))
    canvas.rect(0, h - 0.42 * inch, w, 0.42 * inch, fill=1, stroke=0)
    
    # Header Text
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(0.55 * inch, h - 0.27 * inch, "MEDRAG INDIA: SYSTEM FLOW & ARCHITECTURAL ANALYSIS")
    
    # Footer
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.setFont("Helvetica", 8)
    canvas.drawString(0.55 * inch, 0.35 * inch, "CONFIDENTIAL - CLINICAL DATA SYSTEMS")
    canvas.drawRightString(w - 0.55 * inch, 0.35 * inch, f"Page {doc.page}")
    canvas.restoreState()

def build_pdf():
    doc = BaseDocTemplate(
        OUT,
        pagesize=A4,
        leftMargin=0.55 * inch,
        rightMargin=0.55 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.55 * inch,
        title="MedRAG India Production Architecture Analysis",
        author="Antigravity AI",
    )
    
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=page_frame)])
    
    styles = getSampleStyleSheet()
    
    # Typography Styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        alignment=TA_LEFT,
        textColor=C_PRIMARY,
        spaceAfter=6,
    )
    
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        leading=16,
        textColor=colors.HexColor("#475569"),
        spaceAfter=15,
    )
    
    h1_style = ParagraphStyle(
        "H1",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        textColor=C_SECONDARY,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True,
    )

    h2_style = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        textColor=C_PRIMARY,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True,
    )
    
    body_style = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.2,
        leading=13.5,
        textColor=C_TEXT,
        spaceAfter=6,
    )

    bullet_style = ParagraphStyle(
        "Bullet",
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4,
    )

    code_style = ParagraphStyle(
        "Code",
        parent=styles["Code"],
        fontName="Courier",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#0F172A"),
        backColor=C_LIGHT_BG,
        borderColor=C_BORDER,
        borderWidth=0.5,
        borderPadding=6,
        spaceAfter=8,
    )
    
    callout_style = ParagraphStyle(
        "Callout",
        parent=body_style,
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1E293B"),
        backColor=C_LIGHT_BG,
        borderColor=C_SECONDARY,
        borderWidth=1.5,
        borderPadding=10,
        spaceAfter=10,
    )

    alert_style = ParagraphStyle(
        "Alert",
        parent=body_style,
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#991B1B"),
        backColor=C_ALERT_BG,
        borderColor=C_ALERT_BORDER,
        borderWidth=1,
        borderPadding=10,
        spaceAfter=10,
    )

    flow_style = ParagraphStyle(
        "Flow",
        parent=body_style,
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#065F46"),
        alignment=TA_CENTER,
    )

    story = []
    
    # ----------------------------------------------------
    # PAGE 1: TITLE & EXECUTIVE SUMMARY
    # ----------------------------------------------------
    story.append(Spacer(1, 0.25 * inch))
    story.append(Paragraph("MedRAG India", title_style))
    story.append(Paragraph("Production-Grade Medical Retrieval-Augmented Generation & Agentic Care Flow", subtitle_style))
    
    # Horizontal line
    t_hr = Table([[""]], colWidths=[doc.width], rowHeights=[1.5])
    t_hr.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), C_SECONDARY),
        ('PADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(t_hr)
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("1. Executive Summary & Design Principles", h1_style))
    story.append(Paragraph(
        "MedRAG India is an enterprise-grade medical assistant that combines <b>fine-tuned clinical adapters</b> "
        "with a multi-stage <b>hybrid RAG system</b>. The backend is orchestrating workflows via "
        "<b>LangGraph state machines</b>, ensuring structured, verifiable execution.",
        body_style
    ))
    
    story.append(Paragraph(
        "<b>Core Architectural Principle:</b> Patients receive educational context only, with strict refusals "
        "for direct diagnosis or prescribing queries. Licensed clinicians receive clinical decision support (e.g., differential "
        "considerations and drug interaction safety). The system uses pre-defined action routes and validation rules "
        "rather than allowing the LLM to write directly to DB stores or call external APIs dynamically. All access is audited.",
        callout_style
    ))
    
    story.append(Paragraph("2. System Architecture & Entry Boundaries", h1_style))
    story.append(Paragraph(
        "When a request enters the FastAPI application, a series of validation, consent, and audit processes "
        "trigger before the RAG graph starts:",
        body_style
    ))
    
    story.append(Paragraph("• <b>Authentication & Role Enforcement:</b> Resolves the user identity and validates permissions.", bullet_style))
    story.append(Paragraph("• <b>Compliance & Consent Checks:</b> The <code>ComplianceService</code> checks if a doctor has an active care-team membership and patient-granted consent. Patients can always self-access.", bullet_style))
    story.append(Paragraph("• <b>AI Policy Guardrails:</b> The <code>AiPolicyService</code> evaluates the query for diagnosis/prescription terms. If a patient violates the safety policy, an early refusal is issued. If not, it assigns the role-appropriate prompt instruction (educational vs decision support).", bullet_style))
    story.append(Paragraph("• <b>Audit Trail Logging:</b> The <code>AuditService</code> records the action, actor metadata, target patient, and query size into a hash-chained audit database.", bullet_style))
    
    story.append(PageBreak())
    
    # ----------------------------------------------------
    # PAGE 2: CLINICAL QUERY FLOW (State Machine)
    # ----------------------------------------------------
    story.append(Paragraph("3. Clinical Query State Machine Flow", h1_style))
    story.append(Paragraph(
        "After passing initial gate checks, the query triggers <code>ClinicalRagGraph.invoke()</code>. "
        "The graph coordinates execution across specialized nodes to ensure reliability and safety:",
        body_style
    ))

    # Flowchart visualization via Table
    flow_data = [
        [Paragraph("1. Safety Check Node (safety_check)<br/>Detects clinical emergencies (chest pain, stroke, breathing issues).", flow_style)],
        [Paragraph("↓", ParagraphStyle("Arrow", parent=flow_style, textColor=colors.HexColor("#64748B")))],
        [Paragraph("2. Query Router Node (route_query)<br/>Classifies intent (RAG Guideline vs. Patient Record vs. General Ed vs. No RAG).", flow_style)],
        [Paragraph("↓", ParagraphStyle("Arrow", parent=flow_style, textColor=colors.HexColor("#64748B")))],
        [Paragraph("3. Query Rewrite Node (rewrite_query)<br/>Generates up to 3 retrieval queries with synonyms/lab variants.", flow_style)],
        [Paragraph("↓", ParagraphStyle("Arrow", parent=flow_style, textColor=colors.HexColor("#64748B")))],
        [Paragraph("4. Hybrid Retrieval Node (retrieve)<br/>Queries Qdrant (dense) and BM25 (sparse), performs RRF and Cross-Encoder reranking.", flow_style)],
        [Paragraph("↓", ParagraphStyle("Arrow", parent=flow_style, textColor=colors.HexColor("#64748B")))],
        [Paragraph("5. Evidence Compression Node (compress_evidence)<br/>Selects top 3 overlapping sentences per chunk to save context window.", flow_style)],
        [Paragraph("↓", ParagraphStyle("Arrow", parent=flow_style, textColor=colors.HexColor("#64748B")))],
        [Paragraph("6. Answer Generation Node (generate)<br/>Prompts LLM using role policy and safety disclaimer templates.", flow_style)],
        [Paragraph("↓", ParagraphStyle("Arrow", parent=flow_style, textColor=colors.HexColor("#64748B")))],
        [Paragraph("7. Citation Validation Node (validate_citations)<br/>Scans for inline [source_id] citations. Appends evidence block if missing.", flow_style)],
    ]
    
    t_flow = Table(flow_data, colWidths=[doc.width - 20])
    t_flow.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), C_FLOW_BG),
        ('BACKGROUND', (0,2), (-1,2), C_FLOW_BG),
        ('BACKGROUND', (0,4), (-1,4), C_FLOW_BG),
        ('BACKGROUND', (0,6), (-1,6), C_FLOW_BG),
        ('BACKGROUND', (0,8), (-1,8), C_FLOW_BG),
        ('BACKGROUND', (0,10), (-1,10), C_FLOW_BG),
        ('BACKGROUND', (0,12), (-1,12), C_FLOW_BG),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOX', (0,0), (-1,0), 1, colors.HexColor("#10B981")),
        ('BOX', (0,2), (-1,2), 1, colors.HexColor("#10B981")),
        ('BOX', (0,4), (-1,4), 1, colors.HexColor("#10B981")),
        ('BOX', (0,6), (-1,6), 1, colors.HexColor("#10B981")),
        ('BOX', (0,8), (-1,8), 1, colors.HexColor("#10B981")),
        ('BOX', (0,10), (-1,10), 1, colors.HexColor("#10B981")),
        ('BOX', (0,12), (-1,12), 1, colors.HexColor("#10B981")),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    
    story.append(t_flow)
    story.append(Spacer(1, 10))
    
    story.append(Paragraph("Node Safety Triggers & Exceptions", h2_style))
    story.append(Paragraph(
        "• <b>Emergency Escalation:</b> If <code>safety_check</code> flags an emergency, the graph immediately "
        "bypasses retrieval/generation nodes and jumps to <code>finalize</code>, returning a hardcoded recommendation "
        "to call emergency services (108/112).",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>Policy Refusal:</b> If the <code>AiPolicyService</code> flag was violated (e.g. patient requesting direct diagnosis), "
        "the graph routes directly to <code>finalize</code> to display the policy refusal warning, preventing LLM execution.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>Skip Retrieval:</b> If the query router classifies the query as navigation or help (<code>no_rag_needed</code>), "
        "it skips retrieval nodes entirely and routes directly to the generator.",
        bullet_style
    ))
    
    story.append(PageBreak())

    # ----------------------------------------------------
    # PAGE 3: CARE COORDINATION & LLM BOUNDARIES
    # ----------------------------------------------------
    story.append(Paragraph("4. Care Coordination Agent Flow", h1_style))
    story.append(Paragraph(
        "The Care Coordination agent (<code>CareCoordinationAgent</code>) processes patient events, "
        "symptoms, and appointment requests. Crucially, it uses LangGraph to manage task flow but handles tool execution "
        "deterministically.",
        body_style
    ))

    # Flow details
    story.append(Paragraph(
        "When symptom tracking or health calendars are updated, the graph proceeds through: "
        "<br/><b>assess</b> ➔ <b>schedule_yearly_scan / book_doctor_appointment / request_ambulance</b> ➔ <b>log_action</b>.",
        callout_style
    ))

    story.append(Paragraph(
        "• <b>assess Node:</b> Classifies input symptoms using <code>ClinicalSafetyService</code>. If symptom severity "
        "is >= 9 or emergency terms match, it routes to emergency dispatch. If not, it routes to doctor appointment booking.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>schedule_yearly_scan Node:</b> Automatically records a <code>PatientCalendarEvent</code> and a pending "
        "preventive <code>HealthTask</code> directly inside PostgreSQL using the SQLAlchemy session.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>book_doctor_appointment Node:</b> Automatically records an <code>Appointment</code> table entry with "
        "urgency set relative to the symptom assessment score.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>request_ambulance Node:</b> Calls the <code>AmbulanceDispatchService</code> (EMS boundary) to request "
        "emergency transport, saving an <code>EmergencyDispatchRequest</code> log with provider metadata.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>log_action Node:</b> Records the final state, parameters used, and execution history into the database as a "
        "durable <code>AgentActionLog</code>, firing a secure audit event.",
        bullet_style
    ))

    story.append(Paragraph("5. Tool-Calling Strategy: Bounded vs. Dynamic", h1_style))
    story.append(Paragraph(
        "A critical safety pattern in MedRAG India is that <b>the LLM does not execute direct tool-calling loops</b> "
        "(e.g., using OpenAI's tool-calling APIs or ReAct loops to call arbitrary functions).",
        body_style
    ))

    story.append(Paragraph(
        "<b>Why Dynamic Tool Calling is Banned in Clinical Flows:</b><br/>"
        "1. <b>Non-Deterministic Risk:</b> An LLM cannot be trusted to decide if an ambulance should be dispatched. "
        "Safety and writing database records must rely on strictly audited, deterministic rules.<br/>"
        "2. <b>Data Leakage / Security:</b> Letting an LLM decide which SQL parameters or document directories to query "
        "creates high prompt-injection vulnerability.<br/>"
        "3. <b>Separation of Concerns:</b> The LLM is confined to text-to-text processing nodes (classifying query intent, "
        "rewriting query variants, and generating evidence-grounded answers). Data retrieval (Qdrant/SQL) and database writing "
        "are executed by robust, structured Python code in separate graph nodes.",
        alert_style
    ))
    
    story.append(PageBreak())

    # ----------------------------------------------------
    # PAGE 4: DETAILED SUBSYSTEMS
    # ----------------------------------------------------
    story.append(Paragraph("6. Key Subsystems and Mechanics", h1_style))
    
    story.append(Paragraph("6.1 Hybrid Retrieval Pipeline", h2_style))
    story.append(Paragraph(
        "The <code>HybridMedicalRetriever</code> is designed to maximize recall and precision for Indian medical contexts:",
        body_style
    ))
    story.append(Paragraph(
        "1. <b>Dense Semantic Search:</b> Embeds queries using <code>BGE-M3</code>. Queries the Qdrant database "
        "applying patient-isolation visibility filters (e.g. only public guides or documents specifically matching the current patient's ID).",
        bullet_style
    ))
    story.append(Paragraph(
        "2. <b>Sparse Keyword Search:</b> Runs <code>BM25Okapi</code> keyword searches over the retrieved candidates. "
        "This prevents the semantic model from missing exact chemical/drug names (e.g. <i>Sildenafil</i>, <i>Metformin</i>) "
        "or laboratory metrics (e.g. <i>HbA1c</i>).",
        bullet_style
    ))
    story.append(Paragraph(
        "3. <b>Reciprocal Rank Fusion (RRF):</b> Merges dense and sparse lists using Reciprocal Rank Fusion, "
        "ensuring chunks that score highly in both algorithms appear at the top.",
        bullet_style
    ))
    story.append(Paragraph(
        "4. <b>Cross-Encoder Reranker:</b> Scores query-chunk pairs via a reranker model to filter out irrelevant context.",
        bullet_style
    ))
    story.append(Paragraph(
        "5. <b>Parent Context Expansion & Compression:</b> Retrieves parent context windows, then uses <code>EvidenceCompressionService</code> "
        "to pull out only the top 3 sentences containing maximum overlap with the user's query, preserving model context limits.",
        bullet_style
    ))

    story.append(Paragraph("6.2 Data Security & Regulatory Safeguards", h2_style))
    story.append(Paragraph(
        "The system complies with HIPAA and DPDP regulations through strict data restrictions:",
        body_style
    ))
    story.append(Paragraph(
        "• <b>Download Restrictions:</b> A hard API policy restricts clinical staff from executing raw document downloads. "
        "Only the patient owner is permitted to download binary reports.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>PHI Scrubbing:</b> The <code>PrivacyService</code> automatically redacts common identifiers (Aadhaar, ABHA cards, "
        "emails, phone numbers) before writing conversation data to the database.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>Answer Tracing:</b> The <code>AnswerTraceService</code> records the execution profile (model name, prompt version, "
        "retrieved context snippets, latency, and user role) for full clinical audibility.",
        bullet_style
    ))
    story.append(Paragraph(
        "• <b>Cache Headers:</b> Responses enforce strict HTTP headers to prevent local browser caching of health data:",
        body_style
    ))
    story.append(Paragraph(
        "<code>Cache-Control: no-store, no-cache, must-revalidate</code><br/>"
        "<code>Pragma: no-cache</code><br/>"
        "<code>Expires: 0</code>",
        code_style
    ))

    doc.build(story)
    print(f"Generated PDF: {OUT}")

if __name__ == "__main__":
    build_pdf()
