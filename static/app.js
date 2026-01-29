/**
 * Trace Explorer - Frontend Application
 */

// State
let allTraces = [];
let currentView = 'all';
let currentCategory = null;
let selectedTraceId = null;

// DOM Elements
const traceList = document.getElementById('trace-list');
const detailPanel = document.getElementById('detail-panel');
const panelContent = document.getElementById('panel-content');
const viewTitle = document.getElementById('view-title');
const searchInput = document.getElementById('search-input');
const analysisModal = document.getElementById('analysis-modal');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const totalTracesEl = document.getElementById('total-traces');
const analyzedCountEl = document.getElementById('analyzed-count');
const categoriesSection = document.getElementById('categories-section');

// Category labels for display
const categoryLabels = {
    'showcase': 'Showcase',
    'product_features': 'Features',
    'research_areas': 'Research',
    'dataset_priorities': 'Datasets',
    'wri_connections': 'WRI'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadTraces();
    setupEventListeners();
    checkAnalysisStatus();
});

function setupEventListeners() {
    // Navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const view = btn.dataset.view;
            currentView = view;

            if (view === 'all') {
                currentCategory = null;
                categoriesSection.style.display = 'none';
                viewTitle.textContent = 'All Traces';
                renderTraces(allTraces);
            } else if (view === 'showcase') {
                categoriesSection.style.display = 'none';
                loadTopTraces('showcase');
            } else if (view === 'interests') {
                categoriesSection.style.display = 'block';
                viewTitle.textContent = 'By Interest Category';
                renderTraces(allTraces);
            }
        });
    });

    // Run analysis button
    document.getElementById('run-analysis').addEventListener('click', runAnalysis);

    // View top buttons
    document.querySelectorAll('.view-top-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const category = btn.dataset.category;
            loadTopTraces(category);
        });
    });

    // Close detail panel
    document.getElementById('close-detail').addEventListener('click', () => {
        detailPanel.classList.remove('open');
        selectedTraceId = null;
        document.querySelectorAll('.trace-card').forEach(c => c.classList.remove('selected'));
    });

    // Search
    searchInput.addEventListener('input', debounce((e) => {
        const query = e.target.value.toLowerCase();
        filterTraces(query);
    }, 300));
}

async function loadTraces() {
    try {
        const response = await fetch('/api/traces');
        const data = await response.json();
        allTraces = data.traces;
        totalTracesEl.textContent = data.total;
        renderTraces(allTraces);
    } catch (error) {
        console.error('Error loading traces:', error);
        traceList.innerHTML = '<div class="empty-state"><div class="icon">&#9888;</div><p>Error loading traces</p></div>';
    }
}

async function checkAnalysisStatus() {
    try {
        const response = await fetch('/api/analysis-status');
        const data = await response.json();

        const analyzedCount = data.analyzed.length;
        analyzedCountEl.textContent = analyzedCount;

        data.analyzed.forEach(category => {
            const badge = document.getElementById(`badge-${category}`);
            if (badge) {
                badge.textContent = '✓';
                badge.classList.add('active');
            }
        });

        if (analyzedCount > 0) {
            document.getElementById('analysis-status').textContent =
                `${analyzedCount}/5 categories analyzed`;
        }
    } catch (error) {
        console.error('Error checking analysis status:', error);
    }
}

async function runAnalysis() {
    const btn = document.getElementById('run-analysis');
    btn.disabled = true;
    analysisModal.classList.add('active');

    const categories = ['showcase', 'product_features', 'research_areas', 'dataset_priorities', 'wri_connections'];

    for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        const progress = ((i) / categories.length) * 100;
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `Analyzing ${categoryLabels[category]}...`;

        try {
            await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category })
            });

            const badge = document.getElementById(`badge-${category}`);
            if (badge) {
                badge.textContent = '✓';
                badge.classList.add('active');
            }
        } catch (error) {
            console.error(`Error analyzing ${category}:`, error);
        }
    }

    progressBar.style.width = '100%';
    progressText.textContent = 'Complete!';

    setTimeout(() => {
        analysisModal.classList.remove('active');
        btn.disabled = false;
        loadTraces();
        checkAnalysisStatus();
    }, 1000);
}

async function loadTopTraces(category) {
    try {
        const response = await fetch(`/api/top-traces/${category}`);
        const data = await response.json();

        currentCategory = category;

        if (category === 'showcase') {
            viewTitle.textContent = 'Showcase: Most Impactful Conversations';
            renderShowcaseTraces(data.traces);
        } else {
            viewTitle.textContent = `Top 10: ${data.category_name}`;
            renderTraces(data.traces);
        }
    } catch (error) {
        console.error('Error loading top traces:', error);
    }
}

function renderShowcaseTraces(traces) {
    if (traces.length === 0) {
        traceList.innerHTML = `
            <div class="empty-state">
                <div class="icon">&#127775;</div>
                <p>No showcase traces yet</p>
                <p>Run analysis to find the most impressive conversations</p>
            </div>
        `;
        return;
    }

    const headerHtml = `
        <div class="showcase-header">
            <p class="showcase-intro">These conversations demonstrate GNW's power to help people make great land decisions. Perfect for demos and presentations.</p>
        </div>
    `;

    traceList.innerHTML = headerHtml + traces.map((trace, index) => createShowcaseCard(trace, index + 1)).join('');

    // Add click handlers
    document.querySelectorAll('.trace-card').forEach(card => {
        card.addEventListener('click', () => {
            const traceId = card.dataset.traceId;
            selectTrace(traceId);
        });
    });
}

function renderTraces(traces) {
    if (traces.length === 0) {
        traceList.innerHTML = `
            <div class="empty-state">
                <div class="icon">&#128220;</div>
                <p>No traces found</p>
                <p>Run analysis to see scored traces</p>
            </div>
        `;
        return;
    }

    traceList.innerHTML = traces.map(trace => createTraceCard(trace)).join('');

    // Add click handlers
    document.querySelectorAll('.trace-card').forEach(card => {
        card.addEventListener('click', () => {
            const traceId = card.dataset.traceId;
            selectTrace(traceId);
        });
    });
}

function createTraceCard(trace) {
    const date = new Date(trace.timestamp);
    const formattedDate = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Get first user message for preview
    const userMsg = trace.conversation.find(m => m.role === 'human' || m.role === 'user');
    const aiMsg = trace.conversation.find(m => m.role === 'ai' || m.role === 'assistant');

    // Build score badges (clickable to scroll to analysis)
    let scoreHtml = '';
    if (trace.scores && Object.keys(trace.scores).length > 0) {
        scoreHtml = '<div class="trace-scores">';
        for (const [cat, score] of Object.entries(trace.scores)) {
            const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
            scoreHtml += `
                <a href="#" class="score-badge ${level}" data-category="${cat}" onclick="event.stopPropagation(); scrollToAnalysis('${trace.id}', '${cat}'); return false;">
                    <span class="score-value">${score}</span>
                    <span class="score-label">${categoryLabels[cat] || cat}</span>
                </a>
            `;
        }
        scoreHtml += '</div>';
    }

    // Build interest summary
    let summaryHtml = '';
    if (trace.analysis && Object.keys(trace.analysis).length > 0) {
        summaryHtml = '<div class="trace-summary">' + buildInterestSummary(trace) + '</div>';
    }

    return `
        <div class="trace-card ${trace.id === selectedTraceId ? 'selected' : ''}" data-trace-id="${trace.id}">
            <div class="trace-header">
                <div class="trace-meta">
                    <span class="trace-id">${trace.id.substring(0, 12)}...</span>
                    <span class="trace-time">${formattedDate}</span>
                </div>
                ${scoreHtml}
            </div>
            ${summaryHtml}
            <div class="trace-preview">
                ${userMsg ? `
                    <div class="preview-message">
                        <div class="preview-role user">User</div>
                        <div class="preview-content">${escapeHtml(userMsg.content)}</div>
                    </div>
                ` : ''}
                ${aiMsg ? `
                    <div class="preview-message">
                        <div class="preview-role assistant">Assistant</div>
                        <div class="preview-content">${escapeHtml(aiMsg.content)}</div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function buildInterestSummary(trace) {
    const scores = trace.scores || {};
    const analysis = trace.analysis || {};

    // Map category keys to display names and back
    const categoryToName = {
        'showcase': 'demo potential',
        'product_features': 'product features',
        'research_areas': 'research',
        'dataset_priorities': 'dataset needs',
        'wri_connections': 'WRI work'
    };

    // Identify high-interest areas (score >= 60)
    const highInterest = [];
    const mediumInterest = [];

    for (const [cat, score] of Object.entries(scores)) {
        // Skip WRI connections from the general summary - show it separately
        if (cat === 'wri_connections') continue;

        const name = categoryToName[cat] || cat;
        const clickable = `<a href="#" class="interest-link" data-category="${cat}" onclick="event.stopPropagation(); scrollToAnalysis('${trace.id}', '${cat}'); return false;">${name}</a>`;

        if (score >= 70) {
            highInterest.push(clickable);
        } else if (score >= 40) {
            mediumInterest.push(clickable);
        }
    }

    // Build summary sentence
    let summary = '';
    if (highInterest.length === 0 && mediumInterest.length === 0) {
        summary = 'Low relevance across interest areas.';
    } else if (highInterest.length > 0) {
        summary = `High value for ${highInterest.join(' and ')}`;
        if (mediumInterest.length > 0) {
            summary += `; moderate for ${mediumInterest.join(', ')}`;
        }
        summary += '.';
    } else {
        summary = `Moderate interest for ${mediumInterest.join(' and ')}.`;
    }

    // Add WRI connection if present
    const wriScore = scores['wri_connections'];
    const wriReason = analysis['wri_connections'];
    if (wriScore && wriScore >= 40 && wriReason) {
        summary += ` <span class="wri-connection"><a href="#" class="interest-link" data-category="wri_connections" onclick="event.stopPropagation(); scrollToAnalysis('${trace.id}', 'wri_connections'); return false;">WRI</a>: ${linkifyUrls(wriReason)}</span>`;
    }

    return summary;
}

async function scrollToAnalysis(traceId, category) {
    // First, open the detail panel with this trace
    await selectTrace(traceId);

    // Then scroll to the specific analysis section
    setTimeout(() => {
        const analysisItem = document.querySelector(`.analysis-item[data-category="${category}"]`);
        if (analysisItem) {
            analysisItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight briefly
            analysisItem.classList.add('highlight');
            setTimeout(() => analysisItem.classList.remove('highlight'), 2000);
        }
    }, 100);
}

function createShowcaseCard(trace, rank) {
    const date = new Date(trace.timestamp);
    const formattedDate = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });

    // Get first user message for preview
    const userMsg = trace.conversation.find(m => m.role === 'human' || m.role === 'user');
    const aiMsg = trace.conversation.find(m => m.role === 'ai' || m.role === 'assistant');

    const showcaseScore = trace.scores?.showcase || 0;
    const reason = trace.analysis?.showcase || '';

    // Build score badges for other categories (excluding showcase since it's shown prominently)
    let scoreHtml = '';
    if (trace.scores && Object.keys(trace.scores).length > 0) {
        scoreHtml = '<div class="trace-scores">';
        for (const [cat, score] of Object.entries(trace.scores)) {
            if (cat === 'showcase') continue; // Skip showcase, it's shown separately
            const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
            scoreHtml += `
                <a href="#" class="score-badge ${level}" data-category="${cat}" onclick="event.stopPropagation(); scrollToAnalysis('${trace.id}', '${cat}'); return false;">
                    <span class="score-value">${score}</span>
                    <span class="score-label">${categoryLabels[cat] || cat}</span>
                </a>
            `;
        }
        scoreHtml += '</div>';
    }

    // Build interest summary for other categories
    let summaryHtml = '';
    if (trace.analysis && Object.keys(trace.analysis).length > 1) { // More than just showcase
        summaryHtml = '<div class="trace-summary">' + buildInterestSummary(trace) + '</div>';
    }

    return `
        <div class="trace-card showcase ${trace.id === selectedTraceId ? 'selected' : ''}" data-trace-id="${trace.id}">
            <div class="trace-header">
                <div class="trace-meta">
                    <span class="showcase-rank">#${rank}</span>
                    <span class="trace-time">${formattedDate}</span>
                </div>
                <div class="showcase-score">
                    <span class="score-value">${showcaseScore}</span>
                    <span class="score-label">Impact</span>
                </div>
            </div>
            ${reason ? `<div class="showcase-reason">${escapeHtml(reason)}</div>` : ''}
            ${scoreHtml}
            ${summaryHtml}
            <div class="trace-preview">
                ${userMsg ? `
                    <div class="preview-message">
                        <div class="preview-role user">User</div>
                        <div class="preview-content">${escapeHtml(userMsg.content)}</div>
                    </div>
                ` : ''}
                ${aiMsg ? `
                    <div class="preview-message">
                        <div class="preview-role assistant">Assistant</div>
                        <div class="preview-content">${escapeHtml(aiMsg.content)}</div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

async function selectTrace(traceId) {
    selectedTraceId = traceId;

    // Update selected state
    document.querySelectorAll('.trace-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.traceId === traceId);
    });

    // Load trace details
    try {
        const response = await fetch(`/api/trace/${traceId}`);
        const trace = await response.json();
        renderTraceDetail(trace);
        detailPanel.classList.add('open');
    } catch (error) {
        console.error('Error loading trace:', error);
    }
}

// Store current trace for translation
let currentTraceForTranslation = null;

function renderTraceDetail(trace) {
    currentTraceForTranslation = trace;

    const date = new Date(trace.timestamp);
    const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Build conversation thread with data attributes for translation
    let conversationHtml = `
        <div class="translation-controls">
            <button class="btn-translate" onclick="translateCurrentTrace()">
                <span class="translate-icon">&#127760;</span> Translate to English
            </button>
            <span class="translation-status"></span>
        </div>
        <div class="conversation-thread">
    `;
    for (let i = 0; i < trace.conversation.length; i++) {
        const msg = trace.conversation[i];
        const role = (msg.role === 'human' || msg.role === 'user') ? 'user' : 'assistant';
        const roleLabel = role === 'user' ? 'User' : 'Assistant';
        conversationHtml += `
            <div class="message ${role}" data-msg-index="${i}">
                <div class="message-role">${roleLabel}</div>
                <div class="message-content original">${escapeHtml(msg.content)}</div>
                <div class="message-content translation" style="display: none;"></div>
            </div>
        `;
    }
    conversationHtml += '</div>';

    // Build analysis section
    let analysisHtml = '';
    if (trace.analysis && Object.keys(trace.analysis).length > 0) {
        analysisHtml = '<div class="analysis-section-detail"><h4>LLM Analysis</h4>';
        for (const [cat, reason] of Object.entries(trace.analysis)) {
            const score = trace.scores[cat] || 0;
            const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
            const catName = {
                'showcase': 'Showcase',
                'product_features': 'Product Features',
                'research_areas': 'Research Areas',
                'dataset_priorities': 'Dataset Priorities',
                'wri_connections': 'WRI Connections'
            }[cat] || cat;

            // Use linkifyUrls for WRI connections to make evidence links clickable
            const reasonHtml = cat === 'wri_connections' ? linkifyUrls(reason) : escapeHtml(reason);

            analysisHtml += `
                <div class="analysis-item" data-category="${cat}">
                    <div class="analysis-category">
                        <span class="analysis-category-name">${catName}</span>
                        <span class="analysis-score ${level}">${score}</span>
                    </div>
                    <div class="analysis-reason">${reasonHtml}</div>
                </div>
            `;
        }
        analysisHtml += '</div>';
    }

    panelContent.innerHTML = `
        ${conversationHtml}

        <div class="detail-meta">
            <div class="meta-item">
                <span class="meta-label">Timestamp</span>
                <span class="meta-value">${formattedDate}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Session ID</span>
                <span class="meta-value">${trace.session_id ? trace.session_id.substring(0, 16) + '...' : 'N/A'}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Latency</span>
                <span class="meta-value">${(trace.latency / 1000).toFixed(2)}s</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">Tokens</span>
                <span class="meta-value">${trace.input_tokens + trace.output_tokens} total</span>
            </div>
            ${trace.error_count > 0 ? `
            <div class="meta-item">
                <span class="meta-label">Errors</span>
                <span class="meta-value" style="color: var(--accent-orange)">${trace.error_count}</span>
            </div>
            ` : ''}
        </div>

        ${analysisHtml}
    `;
}

function filterTraces(query) {
    if (!query) {
        renderTraces(allTraces);
        return;
    }

    const filtered = allTraces.filter(trace => {
        const conversationText = trace.conversation
            .map(m => m.content)
            .join(' ')
            .toLowerCase();
        return conversationText.includes(query);
    });

    renderTraces(filtered);
}

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function linkifyUrls(text) {
    if (!text) return '';
    // First escape HTML, then convert URLs to links
    const escaped = escapeHtml(text);
    // Match URLs (http, https, or wri.org/globalforestwatch.org patterns)
    const urlPattern = /(https?:\/\/[^\s<]+|(?:wri\.org|globalforestwatch\.org|research\.wri\.org)\/[^\s<]+)/gi;
    return escaped.replace(urlPattern, (url) => {
        const href = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="evidence-link" onclick="event.stopPropagation();">${url}</a>`;
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Translation functionality
let translationCache = {};
let showingTranslation = false;

async function translateCurrentTrace() {
    if (!currentTraceForTranslation) return;

    const traceId = currentTraceForTranslation.id;
    const btn = document.querySelector('.btn-translate');
    const status = document.querySelector('.translation-status');

    // Toggle if already translated
    if (translationCache[traceId]) {
        toggleTranslationDisplay(traceId);
        return;
    }

    // Show loading state
    btn.disabled = true;
    btn.innerHTML = '<span class="translate-icon">&#8987;</span> Translating...';
    status.textContent = '';

    try {
        const response = await fetch(`/api/translate/${traceId}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Cache the translation
        translationCache[traceId] = data;

        // Apply translations to the DOM
        applyTranslations(data);

        // Update button
        btn.innerHTML = '<span class="translate-icon">&#127760;</span> Show Original';
        status.textContent = `Detected: ${data.detected_language}`;
        showingTranslation = true;

    } catch (error) {
        console.error('Translation error:', error);
        status.textContent = 'Translation failed';
        btn.innerHTML = '<span class="translate-icon">&#127760;</span> Translate to English';
    } finally {
        btn.disabled = false;
    }
}

function applyTranslations(data) {
    const messages = document.querySelectorAll('.conversation-thread .message');

    data.translations.forEach(t => {
        const msgEl = messages[t.index];
        if (msgEl && t.translation) {
            const translationEl = msgEl.querySelector('.message-content.translation');
            const originalEl = msgEl.querySelector('.message-content.original');

            // Add language badge to original
            if (!originalEl.querySelector('.lang-badge')) {
                const badge = document.createElement('span');
                badge.className = 'lang-badge';
                badge.textContent = t.original_language;
                originalEl.insertBefore(badge, originalEl.firstChild);
            }

            // Set translation content
            translationEl.innerHTML = `<span class="lang-badge">English</span>${escapeHtml(t.translation)}`;

            // Show translation, keep original visible but smaller
            originalEl.classList.add('with-translation');
            translationEl.style.display = 'block';
        }
    });
}

function toggleTranslationDisplay(traceId) {
    const btn = document.querySelector('.btn-translate');
    const messages = document.querySelectorAll('.conversation-thread .message');

    showingTranslation = !showingTranslation;

    messages.forEach(msgEl => {
        const translationEl = msgEl.querySelector('.message-content.translation');
        const originalEl = msgEl.querySelector('.message-content.original');

        if (translationEl.innerHTML) {
            if (showingTranslation) {
                originalEl.classList.add('with-translation');
                translationEl.style.display = 'block';
            } else {
                originalEl.classList.remove('with-translation');
                translationEl.style.display = 'none';
            }
        }
    });

    btn.innerHTML = showingTranslation
        ? '<span class="translate-icon">&#127760;</span> Show Original'
        : '<span class="translate-icon">&#127760;</span> Show Translation';
}
