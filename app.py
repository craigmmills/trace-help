"""
Trace Explorer - A web app for exploring Global Nature Watch conversation traces
with LLM-powered analysis using Google Gemini.
"""

import csv
import json
import os
import sys
from datetime import datetime
from flask import Flask, render_template, jsonify, request
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Increase CSV field size limit for large conversation data
csv.field_size_limit(sys.maxsize)

load_dotenv()

app = Flask(__name__)

# Configure Gemini with new SDK
client = genai.Client(api_key=os.getenv('GOOGLE_API_KEY'))

# Interest categories for analysis
INTEREST_CATEGORIES = {
    'showcase': {
        'name': 'Showcase',
        'description': 'Most impressive demos that show GNW\'s power for land decisions',
        'prompt_hint': 'conversations where GNW delivers incredible value - providing actionable insights about deforestation, land use, conservation that would make any audience say "wow, this is powerful". Look for: specific data delivered, clear actionable insights, complex questions answered simply, real-world impact potential, impressive scope of analysis'
    },
    'product_features': {
        'name': 'Product Features',
        'description': 'Conversations suggesting new product features or improvements',
        'prompt_hint': 'user requests for features, pain points, usability issues, feature suggestions'
    },
    'research_areas': {
        'name': 'Research Areas',
        'description': 'Conversations indicating new research directions or scientific questions',
        'prompt_hint': 'novel scientific questions, research gaps, methodology discussions, data analysis needs'
    },
    'dataset_priorities': {
        'name': 'Dataset Priorities',
        'description': 'Conversations highlighting needs for new or improved datasets',
        'prompt_hint': 'requests for data not available, data quality issues, geographic gaps, temporal coverage needs'
    },
    'wri_connections': {
        'name': 'WRI Programs',
        'description': 'Connections to WRI\'s strategic programs, partnerships, policy work, and field initiatives',
        'prompt_hint': 'connections to WRI programs, government/corporate/NGO partnerships, policy initiatives, restoration projects, and published stories about impact'
    }
}


def search_wri_evidence(topic, region, program):
    """Use Google Search grounding to find evidence of WRI's programmatic work on a topic."""
    search_tool = types.Tool(
        google_search=types.GoogleSearch()
    )

    config = types.GenerateContentConfig(
        tools=[search_tool]
    )

    search_prompt = f"""Find an article, news story, blog post, report, or publication that discusses World Resources Institute (WRI) programmatic work related to: {topic} in {region}

Focus on finding content about WRI's:
- Strategic initiatives and programs (not just data tools)
- Partnerships with governments, companies, NGOs, or communities
- Policy work and advocacy
- Field projects and on-the-ground impact
- Country or regional programs
- Named initiatives like: {program if program else 'AFR100, Initiative 20x20, Forest Legality Initiative, Restoration programs'}

Search broadly - content can be from:
- WRI's website (wri.org/insights, wri.org/initiatives)
- News outlets covering WRI's work
- Partner organization websites
- Government announcements about WRI partnerships
- Academic or research publications mentioning WRI programs
- NGO reports featuring WRI collaboration

DO NOT prioritize Global Forest Watch technical documentation. We want stories about WRI's programmatic impact.

Return ONLY a JSON object with:
- "found": true/false
- "url": the exact URL if found (or null)
- "title": the article/page title if found (or null)
- "source": where this was published (e.g., "WRI Insights", "Reuters", "partner NGO")
- "summary": one sentence about what WRI is doing related to this topic

Only return URLs from the search results. If you cannot find relevant content about WRI's programmatic work, set found to false."""

    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=search_prompt,
            config=config
        )

        result_text = response.text

        # Clean up response
        if '```json' in result_text:
            result_text = result_text.split('```json')[1].split('```')[0]
        elif '```' in result_text:
            result_text = result_text.split('```')[1].split('```')[0]

        result = json.loads(result_text.strip())

        # Extract URLs from grounding metadata - these are verified real URLs
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                metadata = candidate.grounding_metadata
                if hasattr(metadata, 'grounding_chunks') and metadata.grounding_chunks:
                    for chunk in metadata.grounding_chunks:
                        if hasattr(chunk, 'web') and chunk.web:
                            uri = chunk.web.uri
                            # Accept any URL from grounding (not just WRI domains)
                            # since news/partner sites also cover WRI work
                            result['url'] = uri
                            result['found'] = True
                            if hasattr(chunk.web, 'title'):
                                result['title'] = chunk.web.title
                            break

        return result
    except Exception as e:
        print(f"Error in WRI search: {e}")
        return {'found': False, 'url': None, 'title': None, 'source': None, 'summary': None}


def analyze_wri_connections_batch(traces):
    """Special analysis to find connections to WRI's programmatic work with verified URLs via Google Search."""
    results = []

    for trace in traces:
        conv_text = get_conversation_text(trace)

        # Step 1: Analyze the trace to identify potential WRI connections
        analysis_prompt = f"""Analyze this conversation from Global Nature Watch and identify if it relates to WRI's programmatic work and strategic initiatives.

CONVERSATION:
{conv_text}

Consider WRI's PROGRAMMATIC work (not just data tools):

**Country & Regional Programs:**
- Indonesia: government partnerships (KLHK), corporate sustainability (palm oil companies), peatland restoration
- Brazil: policy work on Amazon/Cerrado, partnerships with Imazon, state government collaborations
- Africa: AFR100 restoration initiative, country partnerships (Ethiopia, Kenya, Rwanda, DRC), cocoa sustainability
- Mexico/Central America: community forestry support, CONAFOR partnership, Initiative 20x20
- India: forest rights advocacy, state-level restoration programs
- China: sustainable landscapes program, corporate engagement

**Strategic Initiatives:**
- AFR100 (African Forest Landscape Restoration Initiative)
- Initiative 20x20 (Latin America restoration)
- Forest Legality Initiative
- Restoration programs and commitments tracking
- Corporate sustainability & supply chain work
- Cities4Forests urban program
- Climate policy and NDC partnerships

**Types of WRI Engagement:**
- Government partnerships and policy advisory
- Corporate sustainability programs
- NGO and civil society collaborations
- Community and indigenous rights work
- International climate negotiations
- Research partnerships with universities

Return a JSON object:
{{
  "score": 0-100,
  "has_connection": true/false,
  "topic": "specific topic (e.g., 'palm oil supply chains', 'forest restoration commitments', 'climate policy')",
  "region": "geographic region if identifiable",
  "wri_program": "specific WRI program or initiative if any (e.g., 'AFR100', 'Indonesia program', 'Forest Legality Initiative')",
  "partner_type": "type of partner if relevant (e.g., 'government', 'corporate', 'NGO', 'community')",
  "story": "one sentence describing how this connects to WRI's programmatic work"
}}

Scoring:
- 80-100: Direct match to a specific WRI program, named partnership, or strategic initiative
- 60-79: Strong alignment with WRI's programmatic priorities in that region/sector
- 40-59: General thematic alignment with WRI's mission areas
- 0-39: Weak or no connection to WRI's programmatic work"""

        try:
            response = client.models.generate_content(
                model='gemini-2.0-flash',
                contents=analysis_prompt
            )
            result_text = response.text

            if '```json' in result_text:
                result_text = result_text.split('```json')[1].split('```')[0]
            elif '```' in result_text:
                result_text = result_text.split('```')[1].split('```')[0]

            analysis = json.loads(result_text.strip())

            # Step 2: If score is high enough, search for real WRI evidence
            reason = analysis.get('story', 'No specific WRI connection identified.')

            if analysis.get('score', 0) >= 50 and analysis.get('has_connection'):
                topic = analysis.get('topic', '')
                region = analysis.get('region', '')
                program = analysis.get('wri_program', '')
                partner_type = analysis.get('partner_type', '')

                # Build a richer search query focusing on programmatic work
                search_parts = [topic, region]
                if program:
                    search_parts.append(program)
                if partner_type:
                    search_parts.append(f"WRI {partner_type} partnership")

                search_query = ' '.join(filter(None, search_parts))
                if search_query:
                    evidence = search_wri_evidence(search_query, region or 'global', program)

                    if evidence.get('found') and evidence.get('url'):
                        url = evidence['url']
                        source = evidence.get('source', '')
                        source_text = f" ({source})" if source else ""
                        reason = f"{analysis.get('story', '')} See: {url}{source_text}"
                        # Boost score slightly if we found verified evidence
                        analysis['score'] = min(100, analysis.get('score', 0) + 5)

            results.append({
                'trace_id': trace['id'],
                'score': analysis.get('score', 0),
                'reason': reason
            })

        except Exception as e:
            print(f"Error analyzing trace {trace['id']}: {e}")
            results.append({
                'trace_id': trace['id'],
                'score': 0,
                'reason': 'Analysis error'
            })

    return results


def parse_traces(filepath):
    """Parse the CSV export file and extract trace data."""
    traces = []

    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                # Parse JSON fields
                input_data = json.loads(row.get('input', '{}') or '{}')
                output_data = json.loads(row.get('output', '{}') or '{}')

                # Extract messages from input/output
                input_messages = input_data.get('messages', [])
                output_messages = output_data.get('messages', [])

                # Build conversation thread
                conversation = []

                # Process input messages
                for msg in input_messages:
                    content = msg.get('content', '')
                    if content and isinstance(content, str):
                        conversation.append({
                            'role': msg.get('type', 'human'),
                            'content': content
                        })

                # Process output messages (may include full thread)
                seen_contents = set(m['content'] for m in conversation)
                for msg in output_messages:
                    content = msg.get('content', '')
                    # Handle content that might be a list (tool use, etc)
                    if isinstance(content, list):
                        text_parts = [p.get('text', '') for p in content if isinstance(p, dict) and p.get('type') == 'text']
                        content = '\n'.join(text_parts)

                    if content and content not in seen_contents:
                        conversation.append({
                            'role': msg.get('type', 'ai'),
                            'content': content
                        })
                        seen_contents.add(content)

                trace = {
                    'id': row.get('id', ''),
                    'timestamp': row.get('timestamp', ''),
                    'name': row.get('name', ''),
                    'session_id': row.get('sessionId', ''),
                    'user_id': row.get('userId', ''),
                    'conversation': conversation,
                    'latency': float(row.get('latency', 0) or 0),
                    'input_tokens': int(row.get('inputTokens', 0) or 0),
                    'output_tokens': int(row.get('outputTokens', 0) or 0),
                    'total_cost': float(row.get('totalCost', 0) or 0),
                    'error_count': int(row.get('errorCount', 0) or 0),
                    'scores': {},  # Will be populated by LLM analysis
                    'analysis': {}  # Will store detailed analysis
                }

                if conversation:  # Only add traces with actual conversation content
                    traces.append(trace)

            except (json.JSONDecodeError, KeyError, ValueError) as e:
                print(f"Error parsing trace: {e}")
                continue

    return traces


def get_conversation_text(trace):
    """Convert conversation to readable text format."""
    lines = []
    for msg in trace['conversation']:
        role = 'User' if msg['role'] in ['human', 'user'] else 'Assistant'
        content = msg['content'][:2000]  # Truncate long messages
        lines.append(f"{role}: {content}")
    return '\n\n'.join(lines)


def analyze_trace_batch(traces, category_key):
    """Analyze a batch of traces for a specific interest category."""
    category = INTEREST_CATEGORIES[category_key]

    # Build analysis prompt
    traces_text = ""
    for i, trace in enumerate(traces):
        conv_text = get_conversation_text(trace)
        traces_text += f"\n--- TRACE {i+1} (ID: {trace['id']}) ---\n{conv_text}\n"

    prompt = f"""You are analyzing conversation traces from Global Nature Watch, an environmental data platform.

Your task is to score each trace on how interesting it is for: {category['name']}

Category description: {category['description']}
Look for: {category['prompt_hint']}

Score each trace from 0-100 where:
- 0-20: Not relevant to this category
- 21-40: Slightly relevant but low impact
- 41-60: Moderately interesting with some potential
- 61-80: Very interesting with clear actionable insights
- 81-100: Extremely high impact, must-act-on insight

For each trace, provide:
1. A score (0-100)
2. A brief reason (1-2 sentences)

TRACES TO ANALYZE:
{traces_text}

Respond in JSON format:
{{
  "analyses": [
    {{"trace_id": "...", "score": 75, "reason": "..."}},
    ...
  ]
}}

Only output valid JSON, no other text."""

    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt
        )
        result_text = response.text

        # Clean up response - extract JSON
        if '```json' in result_text:
            result_text = result_text.split('```json')[1].split('```')[0]
        elif '```' in result_text:
            result_text = result_text.split('```')[1].split('```')[0]

        result = json.loads(result_text.strip())
        return result.get('analyses', [])
    except Exception as e:
        print(f"Error in LLM analysis: {e}")
        return []


# Global storage for traces and analysis results
traces_data = []
analysis_cache = {}


def load_traces():
    """Load traces from the CSV file."""
    global traces_data
    csv_files = [f for f in os.listdir('.') if f.endswith('.csv') and 'trace' in f.lower()]
    if not csv_files:
        csv_files = [f for f in os.listdir('.') if f.endswith('.csv')]

    if csv_files:
        traces_data = parse_traces(csv_files[0])
        print(f"Loaded {len(traces_data)} traces from {csv_files[0]}")
    else:
        print("No CSV file found!")


@app.route('/')
def index():
    """Main page."""
    return render_template('index.html', categories=INTEREST_CATEGORIES)


@app.route('/api/traces')
def get_traces():
    """Get all traces with optional filtering."""
    category = request.args.get('category')
    limit = request.args.get('limit', type=int)

    result = traces_data.copy()

    # Sort by category score if specified
    if category and category in INTEREST_CATEGORIES:
        result = [t for t in result if category in t.get('scores', {})]
        result.sort(key=lambda x: x['scores'].get(category, 0), reverse=True)

    # Apply limit
    if limit:
        result = result[:limit]

    return jsonify({
        'traces': result,
        'total': len(traces_data),
        'filtered': len(result)
    })


@app.route('/api/trace/<trace_id>')
def get_trace(trace_id):
    """Get a single trace by ID."""
    for trace in traces_data:
        if trace['id'] == trace_id:
            return jsonify(trace)
    return jsonify({'error': 'Trace not found'}), 404


@app.route('/api/analyze', methods=['POST'])
def analyze_traces():
    """Run LLM analysis on all traces for specified category."""
    data = request.json
    category = data.get('category')

    if not category or category not in INTEREST_CATEGORIES:
        return jsonify({'error': 'Invalid category'}), 400

    # Analyze in batches of 5
    batch_size = 5
    all_analyses = []

    for i in range(0, len(traces_data), batch_size):
        batch = traces_data[i:i+batch_size]
        # Use special function for WRI connections
        if category == 'wri_connections':
            analyses = analyze_wri_connections_batch(batch)
        else:
            analyses = analyze_trace_batch(batch, category)
        all_analyses.extend(analyses)

    # Update traces with scores
    analysis_map = {a['trace_id']: a for a in all_analyses}
    for trace in traces_data:
        if trace['id'] in analysis_map:
            analysis = analysis_map[trace['id']]
            trace['scores'][category] = analysis['score']
            trace['analysis'][category] = analysis['reason']

    # Cache results
    analysis_cache[category] = True

    return jsonify({
        'success': True,
        'analyzed': len(all_analyses),
        'category': category
    })


@app.route('/api/analysis-status')
def analysis_status():
    """Check which categories have been analyzed."""
    return jsonify({
        'analyzed': list(analysis_cache.keys()),
        'categories': list(INTEREST_CATEGORIES.keys())
    })


@app.route('/api/top-traces/<category>')
def get_top_traces(category):
    """Get top 10 traces for a category."""
    if category not in INTEREST_CATEGORIES:
        return jsonify({'error': 'Invalid category'}), 400

    scored = [t for t in traces_data if category in t.get('scores', {})]
    scored.sort(key=lambda x: x['scores'].get(category, 0), reverse=True)

    return jsonify({
        'category': category,
        'category_name': INTEREST_CATEGORIES[category]['name'],
        'traces': scored[:10]
    })


# Cache for translations to avoid re-translating
translation_cache = {}


@app.route('/api/translate/<trace_id>')
def translate_trace(trace_id):
    """Translate a trace's conversation to English."""
    # Check cache first
    if trace_id in translation_cache:
        return jsonify(translation_cache[trace_id])

    # Find the trace
    trace = None
    for t in traces_data:
        if t['id'] == trace_id:
            trace = t
            break

    if not trace:
        return jsonify({'error': 'Trace not found'}), 404

    # Build conversation text for translation
    messages_to_translate = []
    for i, msg in enumerate(trace['conversation']):
        messages_to_translate.append({
            'index': i,
            'role': msg['role'],
            'content': msg['content']
        })

    # Use Gemini to detect language and translate
    prompt = f"""Analyze these conversation messages and translate any non-English messages to English.

MESSAGES:
{json.dumps(messages_to_translate, indent=2)}

For each message:
1. Detect the language
2. If not English, provide an English translation
3. If already English, leave translation as null

Return a JSON object:
{{
  "detected_language": "the primary non-English language detected, or 'English' if all messages are in English",
  "translations": [
    {{"index": 0, "original_language": "Spanish", "translation": "English translation here"}},
    {{"index": 1, "original_language": "English", "translation": null}},
    ...
  ]
}}

Only output valid JSON."""

    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt
        )
        result_text = response.text

        # Clean up response
        if '```json' in result_text:
            result_text = result_text.split('```json')[1].split('```')[0]
        elif '```' in result_text:
            result_text = result_text.split('```')[1].split('```')[0]

        result = json.loads(result_text.strip())

        # Cache the result
        translation_cache[trace_id] = result

        return jsonify(result)

    except Exception as e:
        print(f"Error translating trace {trace_id}: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    load_traces()
    app.run(debug=True, port=5001)
