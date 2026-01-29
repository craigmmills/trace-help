/**
 * Trace Explorer - Frontend Application
 */

// State
let allTraces = [];
let currentView = 'all';
let currentCategory = null;
let selectedTraceId = null;
let selectedForPackage = new Set(); // Traces selected for presentation packages
let isSelectionMode = false;

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

    const isSelectedForPackage = selectedForPackage.has(trace.id);

    return `
        <div class="trace-card ${trace.id === selectedTraceId ? 'selected' : ''} ${isSelectedForPackage ? 'selected-for-package' : ''}" data-trace-id="${trace.id}">
            ${createSelectionCheckbox(trace.id)}
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

    const isSelectedForPackage = selectedForPackage.has(trace.id);

    return `
        <div class="trace-card showcase ${trace.id === selectedTraceId ? 'selected' : ''} ${isSelectedForPackage ? 'selected-for-package' : ''}" data-trace-id="${trace.id}">
            ${createSelectionCheckbox(trace.id)}
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

// ==========================================
// PRESENTATION PACKAGE FUNCTIONALITY
// ==========================================

function toggleSelectionMode() {
    isSelectionMode = !isSelectionMode;
    const btn = document.getElementById('toggle-selection');
    const selectionBar = document.getElementById('selection-bar');

    if (isSelectionMode) {
        btn.classList.add('active');
        btn.innerHTML = '<span class="icon">&#10003;</span> Done Selecting';
        selectionBar.classList.add('visible');
        document.body.classList.add('selection-mode');
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<span class="icon">&#9744;</span> Select Traces';
        selectionBar.classList.remove('visible');
        document.body.classList.remove('selection-mode');
    }

    // Re-render to show/hide checkboxes
    if (currentView === 'showcase') {
        loadTopTraces('showcase');
    } else {
        renderTraces(allTraces);
    }

    updateSelectionCount();
}

function toggleTraceSelection(traceId, event) {
    if (event) {
        event.stopPropagation();
    }

    if (selectedForPackage.has(traceId)) {
        selectedForPackage.delete(traceId);
    } else {
        selectedForPackage.add(traceId);
    }

    // Update checkbox state
    const checkbox = document.querySelector(`.select-checkbox[data-trace-id="${traceId}"]`);
    if (checkbox) {
        checkbox.classList.toggle('checked', selectedForPackage.has(traceId));
    }

    // Update card selected state
    const card = document.querySelector(`.trace-card[data-trace-id="${traceId}"]`);
    if (card) {
        card.classList.toggle('selected-for-package', selectedForPackage.has(traceId));
    }

    updateSelectionCount();
}

function updateSelectionCount() {
    const countEl = document.getElementById('selection-count');
    const generateBtn = document.getElementById('generate-packages');

    if (countEl) {
        countEl.textContent = selectedForPackage.size;
    }

    if (generateBtn) {
        generateBtn.disabled = selectedForPackage.size === 0;
    }
}

function clearSelection() {
    selectedForPackage.clear();
    document.querySelectorAll('.select-checkbox.checked').forEach(cb => cb.classList.remove('checked'));
    document.querySelectorAll('.trace-card.selected-for-package').forEach(card => card.classList.remove('selected-for-package'));
    updateSelectionCount();
}

async function generatePresentationPackages() {
    if (selectedForPackage.size === 0) return;

    const modal = document.getElementById('package-modal');
    const progressBar = document.getElementById('package-progress-bar');
    const progressText = document.getElementById('package-progress-text');
    const packageContent = document.getElementById('package-content');

    modal.classList.add('active');
    packageContent.innerHTML = '';
    progressBar.style.width = '0%';
    progressText.textContent = `Generating packages for ${selectedForPackage.size} trace(s)...`;

    const traceIds = Array.from(selectedForPackage);
    const packages = [];

    for (let i = 0; i < traceIds.length; i++) {
        const traceId = traceIds[i];
        const progress = ((i) / traceIds.length) * 100;
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `Generating package ${i + 1} of ${traceIds.length}...`;

        try {
            const response = await fetch(`/api/presentation-package/${traceId}`);
            const pkg = await response.json();
            packages.push(pkg);
        } catch (error) {
            console.error(`Error generating package for ${traceId}:`, error);
            packages.push({ error: error.message, trace_id: traceId });
        }
    }

    progressBar.style.width = '100%';
    progressText.textContent = 'Complete!';

    // Render packages
    setTimeout(() => {
        renderPresentationPackages(packages);
    }, 500);
}

function renderPresentationPackages(packages) {
    const packageContent = document.getElementById('package-content');

    let html = '<div class="packages-container">';

    packages.forEach((pkg, index) => {
        if (pkg.error) {
            html += `
                <div class="package-card error">
                    <div class="package-header">
                        <h3>Package ${index + 1}</h3>
                        <span class="error-badge">Error</span>
                    </div>
                    <p class="error-message">${escapeHtml(pkg.error)}</p>
                </div>
            `;
            return;
        }

        const region = pkg.region || {};
        const capabilities = pkg.gnw_capabilities || {};
        const angle = pkg.presentation_angle || {};
        const regionalCtx = pkg.regional_context || {};
        const wriConn = pkg.wri_connection || {};

        html += `
            <div class="package-card">
                <div class="package-header">
                    <h3>Package ${index + 1}: ${region.country || 'Unknown Region'}${region.area ? ` - ${region.area}` : ''}</h3>
                    <span class="package-date">${pkg.timestamp ? new Date(pkg.timestamp).toLocaleDateString() : ''}</span>
                </div>

                ${pkg.summary ? `<div class="package-summary">${escapeHtml(pkg.summary)}</div>` : ''}

                <div class="package-section">
                    <h4><span class="section-icon">&#127908;</span> Demo Prompts</h4>
                    <div class="demo-prompts">
                        ${(pkg.demo_prompts || []).map((prompt, i) => `
                            <div class="demo-prompt">
                                <span class="prompt-number">${i + 1}</span>
                                <div class="prompt-text">${escapeHtml(prompt)}</div>
                                <button class="copy-btn" onclick="copyToClipboard('${escapeHtml(prompt).replace(/'/g, "\\'")}', this)">Copy</button>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="package-section">
                    <h4><span class="section-icon">&#127758;</span> Regional Context</h4>
                    <div class="regional-context">
                        <div class="context-location">
                            <strong>Location:</strong> ${region.area || 'N/A'}, ${region.country || 'N/A'}
                            ${region.coordinates ? `<span class="coords">(${region.coordinates})</span>` : ''}
                        </div>
                        ${region.topics && region.topics.length > 0 ? `
                            <div class="context-topics">
                                <strong>Key Topics:</strong>
                                ${region.topics.map(t => `<span class="topic-tag">${escapeHtml(t)}</span>`).join('')}
                            </div>
                        ` : ''}
                        ${regionalCtx.context ? `
                            <div class="context-background">
                                <strong>Geopolitical/Economic Context:</strong>
                                <p>${escapeHtml(regionalCtx.context)}</p>
                            </div>
                        ` : ''}
                        ${regionalCtx.recent_events && regionalCtx.recent_events.length > 0 ? `
                            <div class="context-events">
                                <strong>Recent Developments:</strong>
                                <ul>
                                    ${regionalCtx.recent_events.map(e => `<li>${escapeHtml(e)}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        ${regionalCtx.url ? `
                            <div class="context-source">
                                <a href="${regionalCtx.url}" target="_blank" rel="noopener noreferrer" class="source-link">
                                    Source: ${regionalCtx.source || regionalCtx.url}
                                </a>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="package-section">
                    <h4><span class="section-icon">&#127760;</span> WRI Program Connection</h4>
                    <div class="wri-connection-detail">
                        ${wriConn.found ? `
                            <p>${escapeHtml(wriConn.summary || 'Connection found')}</p>
                            ${wriConn.url ? `
                                <a href="${wriConn.url}" target="_blank" rel="noopener noreferrer" class="wri-link">
                                    ${wriConn.title || wriConn.url}
                                </a>
                            ` : ''}
                        ` : `
                            <p class="no-connection">No direct WRI program connection identified. Consider framing around general WRI mission alignment.</p>
                        `}
                        ${pkg.existing_analysis && pkg.existing_analysis.analysis && pkg.existing_analysis.analysis.wri_connections ? `
                            <div class="existing-wri-analysis">
                                <strong>Previous Analysis:</strong> ${escapeHtml(pkg.existing_analysis.analysis.wri_connections)}
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="package-section">
                    <h4><span class="section-icon">&#9881;</span> GNW Capabilities Highlighted</h4>
                    <div class="capabilities-grid">
                        ${capabilities.data_sources && capabilities.data_sources.length > 0 ? `
                            <div class="capability-item">
                                <strong>Data Sources:</strong>
                                <ul>${capabilities.data_sources.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>
                            </div>
                        ` : ''}
                        ${capabilities.analysis_types && capabilities.analysis_types.length > 0 ? `
                            <div class="capability-item">
                                <strong>Analysis Types:</strong>
                                <ul>${capabilities.analysis_types.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
                            </div>
                        ` : ''}
                        ${capabilities.unique_insights && capabilities.unique_insights.length > 0 ? `
                            <div class="capability-item highlight">
                                <strong>Unique Insights:</strong>
                                <ul>${capabilities.unique_insights.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>
                            </div>
                        ` : ''}
                        ${capabilities.technical_highlights && capabilities.technical_highlights.length > 0 ? `
                            <div class="capability-item">
                                <strong>Technical Highlights:</strong>
                                <ul>${capabilities.technical_highlights.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="package-section">
                    <h4><span class="section-icon">&#127919;</span> Presentation Angle</h4>
                    <div class="presentation-angle">
                        ${angle.ideal_audience && angle.ideal_audience.length > 0 ? `
                            <div class="angle-item">
                                <strong>Ideal Audience:</strong>
                                ${angle.ideal_audience.map(a => `<span class="audience-tag">${escapeHtml(a)}</span>`).join('')}
                            </div>
                        ` : ''}
                        ${angle.story ? `
                            <div class="angle-item">
                                <strong>The Story:</strong>
                                <p>${escapeHtml(angle.story)}</p>
                            </div>
                        ` : ''}
                        ${angle.key_messages && angle.key_messages.length > 0 ? `
                            <div class="angle-item key-messages">
                                <strong>Key Messages:</strong>
                                <ol>${angle.key_messages.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ol>
                            </div>
                        ` : ''}
                        ${angle.follow_up_questions && angle.follow_up_questions.length > 0 ? `
                            <div class="angle-item">
                                <strong>Potential Audience Questions:</strong>
                                <ul>${angle.follow_up_questions.map(q => `<li>${escapeHtml(q)}</li>`).join('')}</ul>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="package-actions">
                    <button class="btn-secondary" onclick="viewOriginalTrace('${pkg.trace_id}')">View Original Trace</button>
                    <button class="btn-secondary" onclick="exportPackageAsText(${index})">Export as Text</button>
                </div>
            </div>
        `;
    });

    html += '</div>';

    const packageContent2 = document.getElementById('package-content');
    packageContent2.innerHTML = html;

    // Store packages for export
    window.currentPackages = packages;
}

function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.classList.add('copied');
        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
        }, 1500);
    });
}

function viewOriginalTrace(traceId) {
    closePackageModal();
    selectTrace(traceId);
}

function exportPackageAsText(index) {
    const pkg = window.currentPackages[index];
    if (!pkg) return;

    let text = `PRESENTATION PACKAGE
==================

`;

    if (pkg.region) {
        text += `LOCATION: ${pkg.region.area || ''}, ${pkg.region.country || ''}\n`;
        if (pkg.region.coordinates) text += `COORDINATES: ${pkg.region.coordinates}\n`;
        text += '\n';
    }

    if (pkg.summary) {
        text += `SUMMARY:\n${pkg.summary}\n\n`;
    }

    text += `DEMO PROMPTS:\n`;
    (pkg.demo_prompts || []).forEach((prompt, i) => {
        text += `${i + 1}. ${prompt}\n\n`;
    });

    if (pkg.regional_context && pkg.regional_context.context) {
        text += `\nREGIONAL CONTEXT:\n${pkg.regional_context.context}\n`;
        if (pkg.regional_context.recent_events && pkg.regional_context.recent_events.length > 0) {
            text += `\nRecent Developments:\n`;
            pkg.regional_context.recent_events.forEach(e => {
                text += `- ${e}\n`;
            });
        }
        if (pkg.regional_context.url) {
            text += `\nSource: ${pkg.regional_context.url}\n`;
        }
    }

    if (pkg.wri_connection && pkg.wri_connection.found) {
        text += `\nWRI CONNECTION:\n${pkg.wri_connection.summary || ''}\n`;
        if (pkg.wri_connection.url) {
            text += `Link: ${pkg.wri_connection.url}\n`;
        }
    }

    if (pkg.gnw_capabilities) {
        text += `\nGNW CAPABILITIES DEMONSTRATED:\n`;
        if (pkg.gnw_capabilities.unique_insights) {
            text += `\nUnique Insights:\n`;
            pkg.gnw_capabilities.unique_insights.forEach(i => text += `- ${i}\n`);
        }
        if (pkg.gnw_capabilities.technical_highlights) {
            text += `\nTechnical Highlights:\n`;
            pkg.gnw_capabilities.technical_highlights.forEach(t => text += `- ${t}\n`);
        }
    }

    if (pkg.presentation_angle) {
        text += `\nPRESENTATION ANGLE:\n`;
        if (pkg.presentation_angle.story) {
            text += `\nStory: ${pkg.presentation_angle.story}\n`;
        }
        if (pkg.presentation_angle.key_messages) {
            text += `\nKey Messages:\n`;
            pkg.presentation_angle.key_messages.forEach((m, i) => text += `${i + 1}. ${m}\n`);
        }
        if (pkg.presentation_angle.ideal_audience) {
            text += `\nIdeal Audience: ${pkg.presentation_angle.ideal_audience.join(', ')}\n`;
        }
    }

    // Create download
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presentation-package-${pkg.trace_id.substring(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function closePackageModal() {
    document.getElementById('package-modal').classList.remove('active');
}

// Helper to create checkbox HTML for selection mode
function createSelectionCheckbox(traceId) {
    if (!isSelectionMode) return '';
    const isChecked = selectedForPackage.has(traceId);
    return `
        <div class="select-checkbox ${isChecked ? 'checked' : ''}"
             data-trace-id="${traceId}"
             onclick="toggleTraceSelection('${traceId}', event)">
            <span class="checkbox-icon">${isChecked ? '&#10003;' : ''}</span>
        </div>
    `;
}
