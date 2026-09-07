const iconPaths = {
  spark: '<path d="m12 3-1.2 4.8L6 9l4.8 1.2L12 15l1.2-4.8L18 9l-4.8-1.2L12 3Z"/><path d="m19 14-.55 2.45L16 17l2.45.55L19 20l.55-2.45L22 17l-2.45-.55L19 14Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  star: '<path d="m12 3 2.78 5.63 6.22.9-4.5 4.38 1.06 6.2L12 17.18l-5.56 2.93 1.06-6.2L3 9.53l6.22-.9L12 3Z"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M8 7h8M8 10h6"/>',
  key: '<path d="M15.5 8.5a4.5 4.5 0 1 0-1.12 2.97L21 18v-3h-2v-2h-2.5l-1.12-1.13A4.5 4.5 0 0 0 15.5 8.5Z"/><path d="M8.5 8.5h.01"/>',
  'arrow-up-right': '<path d="M7 17 17 7M8 7h9v9"/>',
  'arrow-right': '<path d="M4 12h15M13 6l6 6-6 6"/>',
  chevrons: '<path d="m8 9 4-4 4 4M8 15l4 4 4-4"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  'more-horizontal': '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
  gem: '<path d="m6 3 6-1 6 1 3 5-9 12L3 8l3-5Z"/><path d="m3 8 9 1 9-1M12 9 9 3m3 6 3-6"/>',
  expand: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5"/><path d="M3 8 9 2M21 8l-6-6M3 16l6 6m12-6-6 6"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m3 17 5-5 3 3 2-2 8 7"/>',
  video: '<rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-2v8l-4-2"/><path d="m9 10 3 2-3 2v-4Z" fill="currentColor" stroke="none"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  upload: '<path d="M12 16V4M8 8l4-4 4 4M4 15v4h16v-4"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};

const state = {
  mediaType: 'image',
  source: 'text',
  ratio: '1:1',
  quality: '1k',
  duration: 5,
  audio: true,
  model: 'default',
  models: [],
  modelsLoaded: false,
  connected: false,
  configLoaded: false,
  generating: false,
  imageData: null,
  activeProject: null,
  projects: [],
  libraryFilter: 'all',
};

const defaultPrompt = 'A sunlit glasshouse floating above the clouds, lush tropical plants, slow cinematic camera drift, soft morning haze.';
const promptEnhancement = ' Cinematic lighting, intentional composition, subtle texture, and a sense of wonder.';
const ratioMeta = {
  '1:1': { label: 'Square', resolution: '1024 × 1024', short: 'SQUARE' },
  '16:9': { label: 'Landscape', resolution: '1536 × 864', short: 'LANDSCAPE' },
  '9:16': { label: 'Portrait', resolution: '864 × 1536', short: 'PORTRAIT' },
  '4:3': { label: 'Classic', resolution: '1152 × 864', short: 'CLASSIC' },
};
const artMarkup = {
  glasshouse: '<div class="art-sun"></div><div class="art-hill hill-one"></div><div class="art-hill hill-two"></div><div class="art-house"><div class="house-roof"></div><div class="house-window window-one"></div><div class="house-window window-two"></div><div class="house-glow"></div></div><div class="art-plant plant-left"><i></i><i></i><i></i></div><div class="art-plant plant-right"><i></i><i></i><i></div><div class="art-mist mist-one"></div><div class="art-mist mist-two"></div><div class="art-film-grain"></div>',
  velvet: '<span class="velvet-orb"></span><span class="velvet-star"></span><div class="art-film-grain"></div>',
  tide: '<span class="tide-moon"></span><span class="tide-wave"></span><div class="art-film-grain"></div>',
  atelier: '<span class="atelier-window"></span><span class="atelier-figure"></span><div class="art-film-grain"></div>',
};
const baseLibrary = [
  { key: 'glasshouse', title: 'Glasshouse above the clouds', type: 'image', meta: 'just now', art: 'art-glasshouse', prompt: defaultPrompt },
  { key: 'velvet', title: 'Velvet orbit', type: 'video', meta: 'yesterday', art: 'art-velvet', prompt: 'A velvet planet turning slowly in a midnight room, soft lavender light.' },
  { key: 'tide', title: 'Lemon tide study', type: 'image', meta: 'Aug 28', art: 'art-tide', prompt: 'A lemon moon rising over a warm, quiet tide at dusk.' },
  { key: 'atelier', title: 'Atelier after rain', type: 'video', meta: 'Aug 26', art: 'art-atelier', prompt: 'An artist studio after rain, reflections moving across the window.' },
  { key: 'moss', title: 'Moss cathedral', type: 'image', meta: 'Aug 22', art: 'art-tide', prompt: 'A cathedral made of moss and light, tiny figures wandering inside.' },
  { key: 'afterglow', title: 'Afterglow motel', type: 'video', meta: 'Aug 18', art: 'art-velvet', prompt: 'A lonely motel sign humming in the desert after sunset.' },
  { key: 'paper-city', title: 'Paper city, rain', type: 'image', meta: 'Aug 11', art: 'art-atelier', prompt: 'A handmade paper city unfolding in the rain, tactile miniature scale.' },
  { key: 'slow-orbit', title: 'Slow orbit', type: 'video', meta: 'Aug 04', art: 'art-glasshouse', prompt: 'A quiet spacecraft drifting through a field of wildflowers.' },
];

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

function icon(name, size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || ''}</svg>`;
}

function mountIcons(scope = document) {
  $$('[data-icon]', scope).forEach((element) => {
    const name = [...element.classList].find((className) => iconPaths[className]);
    const requested = element.dataset.icon || name;
    if (requested && iconPaths[requested]) element.innerHTML = icon(requested);
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function formatCredits(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat('en-US').format(number) : '—';
}

function defaultModelRecord() {
  return {
    id: 'default',
    name: 'Magic Hour Default',
    availableFor: ['image', 'video'],
    description: 'Magic Hour picks the current recommendation for your account.',
    tools: ['Text to Image', 'Text to Video', 'Image to Video'],
    resolutions: ['640px', '480p', '1k', '720p', '2k', '1080p', '4k'],
    durations: [3, 4, 5, 6, 7, 8, 9, 10],
    audio: true,
    recommended: true,
  };
}

function getActiveModel() {
  return state.models.find((model) => model.id === state.model) || state.models.find((model) => model.id === 'default') || defaultModelRecord();
}

function modelIsAvailable(model) {
  return Boolean(model?.availableFor?.includes(state.mediaType));
}

function modelRatios(model) {
  if (state.mediaType === 'image') return ['1:1', '16:9', '9:16', '4:3'];
  if (model?.id === 'sora-2') return ['16:9', '9:16'];
  return ['16:9', '9:16', '1:1'];
}

function saveModelChoice() {
  try { localStorage.setItem('magic-hour-model', state.model); } catch { /* Storage may be unavailable. */ }
}

function loadModelChoice() {
  try {
    const saved = localStorage.getItem('magic-hour-model');
    if (saved) state.model = saved;
  } catch { /* Storage may be unavailable. */ }
}

function saveModelCatalog() {
  try { localStorage.setItem('magic-hour-model-catalog', JSON.stringify(state.models)); } catch { /* Storage may be unavailable. */ }
}

function loadStoredModelCatalog() {
  try {
    const saved = JSON.parse(localStorage.getItem('magic-hour-model-catalog') || 'null');
    return Array.isArray(saved) && saved.length ? saved : null;
  } catch {
    return null;
  }
}

function updateModelDetails() {
  const model = getActiveModel();
  $('#model-description').textContent = model.description || 'Magic Hour model';
  $('#model-count').textContent = `${Math.max(0, state.models.length - 1) || 26} models`;
  const audioToggle = $('#audio-toggle');
  const audioSupported = state.mediaType !== 'video' || model.audio !== false;
  audioToggle.disabled = !audioSupported;
  if (!audioSupported) {
    state.audio = false;
    audioToggle.classList.remove('is-on');
    audioToggle.setAttribute('aria-checked', 'false');
  }
  if (state.mediaType === 'video' && audioSupported && !audioToggle.disabled) {
    audioToggle.disabled = false;
  }
}

function renderModelOptions() {
  const select = $('#model-select');
  if (!select) return;
  const currentModel = getActiveModel();
  const available = state.models.filter(modelIsAvailable);
  const unavailable = state.models.filter((model) => !modelIsAvailable(model));
  const availableOptions = available.map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(model.name)}${model.recommended ? ' · recommended' : ''}</option>`).join('');
  const unavailableOptions = unavailable.map((model) => `<option value="${escapeHtml(model.id)}" disabled>${escapeHtml(model.name)} · ${escapeHtml((model.tools || []).join(', '))}</option>`).join('');
  select.innerHTML = `<optgroup label="Ready for ${state.mediaType === 'image' ? 'image generation' : 'video generation'}">${availableOptions}</optgroup>${unavailableOptions ? `<optgroup label="Other catalog models">${unavailableOptions}</optgroup>` : ''}`;
  select.value = modelIsAvailable(currentModel) ? currentModel.id : (available[0]?.id || 'default');
  if (select.value !== state.model) state.model = select.value;
  updateModelDetails();
}

function renderModelCatalog(filter = 'all', query = '') {
  const grid = $('#model-catalog-grid');
  if (!grid) return;
  const search = query.trim().toLowerCase();
  const models = state.models.filter((model) => model.id !== 'default').filter((model) => filter === 'all' || model.kind === filter).filter((model) => {
    if (!search) return true;
    return [model.name, model.id, model.description, ...(model.tools || [])].join(' ').toLowerCase().includes(search);
  });
  $('#model-total').textContent = String(Math.max(0, state.models.filter((model) => model.id !== 'default').length) || 26);
  if (!models.length) {
    grid.innerHTML = '<div class="model-catalog-empty"><span data-icon="search"></span><strong>No models found</strong><span>Try a different name or filter.</span></div>';
    mountIcons(grid);
    return;
  }
  grid.innerHTML = models.map((model) => {
    const ready = modelIsAvailable(model);
    const kindLabel = model.kind === 'video' ? 'Video' : 'Image';
    const tools = (model.tools || []).join(' · ');
    const resolutions = (model.resolutions || []).join(' · ');
    return `<article class="model-catalog-card${ready ? ' is-ready' : ' is-catalog-only'}" data-catalog-model="${escapeHtml(model.id)}">
      <div class="model-card-top"><span class="model-kind-badge ${model.kind === 'video' ? 'video-badge' : 'image-badge'}"><span data-icon="${model.kind === 'video' ? 'video' : 'image'}"></span>${kindLabel}</span><span class="model-ready-label">${ready ? 'Ready here' : 'Other tool'}</span></div>
      <h3>${escapeHtml(model.name)}${model.recommended ? '<span class="recommended-mark">Recommended</span>' : ''}</h3>
      <code>${escapeHtml(model.id)}</code>
      <p>${escapeHtml(model.description || '')}</p>
      <div class="model-tool-tags">${(model.tools || []).map((tool) => `<span>${escapeHtml(tool)}</span>`).join('')}</div>
      <div class="model-card-footer"><span class="model-resolution-copy">${escapeHtml(resolutions || 'Account default')}</span><button class="model-use-button" type="button" data-use-model="${escapeHtml(model.id)}"${ready ? '' : ' disabled'}>${ready ? 'Use model' : 'Not for this tool'}${ready ? icon('arrow-up-right', 12) : ''}</button></div>
    </article>`;
  }).join('');
  mountIcons(grid);
}

function openModelCatalog() {
  $('#model-modal-backdrop').hidden = false;
  renderModelCatalog($('.model-filter.is-active')?.dataset.modelFilter || 'all', $('#model-search').value);
  $('#model-search').focus();
}

function closeModelCatalog() {
  $('#model-modal-backdrop').hidden = true;
}

function refreshModelSettings() {
  const model = getActiveModel();
  const allowedQuality = (model.resolutions || []).filter((resolution) => state.mediaType === 'image' ? /^(640px|1k|2k|4k)$/.test(resolution) : /^(360p|480p|720p|1080p|4k)$/.test(resolution));
  const quality = $('#quality');
  const qualityOptions = allowedQuality.length ? allowedQuality : (state.mediaType === 'image' ? ['1k'] : ['720p']);
  const qualityLabels = { '640px': '640px · Draft', '1k': '1K · Standard', '2k': '2K · Detailed', '4k': '4K · Cinematic', '360p': '360p · Quick', '480p': '480p · Quick', '720p': '720p · Standard', '1080p': '1080p · HD' };
  if (!qualityOptions.includes(state.quality)) state.quality = qualityOptions.includes(state.mediaType === 'image' ? '1k' : '720p') ? (state.mediaType === 'image' ? '1k' : '720p') : qualityOptions[0];
  quality.innerHTML = qualityOptions.map((value) => `<option value="${value}">${qualityLabels[value] || value}</option>`).join('');
  quality.value = state.quality;

  if (state.mediaType === 'video') {
    const durationSelect = $('#duration');
    const durations = model.durations?.length ? model.durations : [5];
    if (!durations.includes(state.duration)) state.duration = durations.reduce((closest, value) => Math.abs(value - state.duration) < Math.abs(closest - state.duration) ? value : closest, durations[0]);
    durationSelect.innerHTML = durations.map((value) => `<option value="${value}">${value} second${value === 1 ? '' : 's'}</option>`).join('');
    durationSelect.value = String(state.duration);
  }
  const validRatios = modelRatios(model);
  if (!validRatios.includes(state.ratio)) updateRatio(validRatios[0]);
  setPreviewTypeLabel();
}

let toastTimer;
function showToast(message, type = 'success') {
  const toast = $('#toast');
  const copy = $('#toast-copy');
  const toastIcon = $('.toast-icon', toast);
  if (!toast || !copy) return;
  copy.textContent = message;
  toastIcon.innerHTML = icon(type === 'error' ? 'info' : type === 'demo' ? 'spark' : 'check', 14);
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 4200);
}

function updatePromptCount() {
  const prompt = $('#prompt');
  $('#prompt-count').textContent = `${prompt.value.length.toLocaleString()} / 2k`;
}

function updateRatio(ratio) {
  state.ratio = ratio;
  const stage = $('#preview-stage');
  stage.dataset.ratio = ratio;
  const meta = ratioMeta[ratio];
  $('#canvas-note').textContent = meta.label;
  $('#preview-resolution').textContent = meta.resolution;
  $('#preview-size-copy').textContent = `${meta.short} · ${ratio}`;
  $$('.ratio-button').forEach((button) => {
    const isActive = button.dataset.ratio === ratio;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-checked', String(isActive));
  });
}

function setPreviewTypeLabel() {
  $('#preview-type').textContent = state.mediaType === 'image' ? 'Image preview' : 'Video preview';
  $('#preview-resolution').textContent = state.mediaType === 'image' ? ratioMeta[state.ratio].resolution : `${state.duration}s · ${state.quality}`;
  $('#preview-size-copy').textContent = `${state.mediaType === 'image' ? ratioMeta[state.ratio].short : `${state.duration} SEC`} · ${state.ratio}`;
}

function updateMediaUI() {
  $$('.media-toggle-button').forEach((button) => {
    const isActive = button.dataset.mediaType === state.mediaType;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });
  const isVideo = state.mediaType === 'video';
  $('#source-toggle').hidden = !isVideo;
  $('#reference-upload').hidden = !(isVideo && state.source === 'image');
  $('#duration-setting').hidden = !isVideo;
  $('#audio-setting').hidden = !isVideo;
  $$('.source-button').forEach((button) => {
    const isActive = button.dataset.source === state.source;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });
  $('#generate-label').textContent = isVideo ? 'Generate video' : 'Generate image';
  $('#cost-value').textContent = isVideo ? '450' : '5';
  $('#preview-footer-copy').textContent = isVideo ? 'A moving moment, ready when you are.' : 'A quiet place to grow wild ideas.';
  if (!state.models.length) state.models = [defaultModelRecord()];
  renderModelOptions();
  refreshModelSettings();
  updateModelDetails();
}

function setMediaType(type) {
  state.mediaType = type === 'video' ? 'video' : 'image';
  if (state.mediaType === 'image') state.source = 'text';
  updateMediaUI();
}

function setSource(source) {
  state.source = source === 'image' ? 'image' : 'text';
  updateMediaUI();
}

function renderArt(seed = 'glasshouse', outputUrl = null, kind = 'image') {
  const preview = $('#preview-art');
  const artClass = seed === 'velvet' ? 'art-velvet' : seed === 'tide' ? 'art-tide' : seed === 'atelier' ? 'art-atelier' : 'art-glasshouse';
  preview.className = `preview-art ${artClass}${outputUrl ? ' has-output' : ''}`;
  let output = '';
  if (outputUrl) {
    output = kind === 'video'
      ? `<video class="output-video" src="${escapeHtml(outputUrl)}" autoplay muted loop playsinline controls></video>`
      : `<img class="output-image" src="${escapeHtml(outputUrl)}" alt="Generated Magic Hour output" />`;
  }
  preview.innerHTML = `${output}${artMarkup[seed] || artMarkup.glasshouse}`;
  mountIcons(preview);
}

function setPreviewCopy(title, prompt = '') {
  $('#preview-caption').textContent = title;
  if (prompt) $('#preview-footer-copy').textContent = prompt;
}

function selectSeed(seed) {
  const item = baseLibrary.find((entry) => entry.key === seed) || baseLibrary[0];
  $$('.creation-card').forEach((card) => card.classList.toggle('is-selected', card.dataset.seed === item.key));
  state.activeProject = null;
  renderArt(item.key, null, item.type);
  $('#preview-empty').hidden = true;
  $('#preview-loading').hidden = true;
  $('#render-status').className = 'render-status';
  $('#render-status-label').textContent = 'Ready to create';
  $('#preview-caption').textContent = item.title;
  $('#prompt').value = item.prompt;
  updatePromptCount();
  setMediaType(item.type);
  updateRatio('1:1');
}

function setGeneratingUi(isGenerating, status = 'queued') {
  state.generating = isGenerating;
  const button = $('#generate-button');
  button.disabled = isGenerating;
  $('#preview-loading').hidden = !isGenerating;
  $('#preview-empty').hidden = true;
  $('#preview-art').classList.toggle('is-dimmed', isGenerating);
  const renderStatus = $('#render-status');
  renderStatus.className = isGenerating ? 'render-status is-rendering' : 'render-status';
  const labels = { queued: 'In the queue', rendering: 'Rendering now', complete: 'Ready to create', error: 'Render failed' };
  $('#render-status-label').textContent = labels[status] || labels.queued;
  $('#loading-title').textContent = status === 'queued' ? 'Your idea is in line' : 'Building your frame';
  $('#loading-detail').textContent = status === 'queued' ? 'Magic Hour is finding the right light.' : 'Pixels are taking their shape.';
}

function setCompletedUi(project) {
  state.generating = false;
  $('#generate-button').disabled = false;
  $('#preview-loading').hidden = true;
  $('#preview-empty').hidden = true;
  $('#preview-art').classList.remove('is-dimmed');
  const renderStatus = $('#render-status');
  renderStatus.className = 'render-status is-complete';
  $('#render-status-label').textContent = 'Render complete';
  const title = project.title || titleFromPrompt(project.prompt);
  $('#preview-caption').textContent = title;
  if (project.outputUrl) renderArt(project.seed || 'glasshouse', project.outputUrl, project.kind);
  else renderArt(project.seed || 'glasshouse');
  setPreviewTypeLabel();
}

function titleFromPrompt(prompt) {
  const words = String(prompt || 'New creation').replace(/[,.!?;:]/g, '').split(/\s+/).filter(Boolean);
  if (!words.length) return 'New creation';
  const title = words.slice(0, 5).join(' ');
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function readStoredProjects() {
  try {
    const saved = JSON.parse(localStorage.getItem('magic-hour-projects') || '[]');
    state.projects = Array.isArray(saved) ? saved.slice(0, 12) : [];
  } catch {
    state.projects = [];
  }
}

function persistProjects() {
  try { localStorage.setItem('magic-hour-projects', JSON.stringify(state.projects.slice(0, 12))); } catch { /* Storage can be unavailable in private previews. */ }
}

function upsertProject(project) {
  const index = state.projects.findIndex((entry) => entry.id === project.id);
  if (index === -1) state.projects.unshift(project);
  else state.projects[index] = { ...state.projects[index], ...project };
  state.projects = state.projects.slice(0, 12);
  persistProjects();
  $('#recent-count').textContent = String(4 + state.projects.length);
  renderLibrary();
}

function allLibraryItems() {
  const generated = state.projects.map((project) => ({
    key: project.id,
    id: project.id,
    title: project.title || titleFromPrompt(project.prompt),
    type: project.kind,
    meta: project.status === 'complete' ? 'just now' : project.status || 'rendering',
    art: project.art || 'art-glasshouse',
    outputUrl: project.outputUrl,
    prompt: project.prompt,
    favorite: Boolean(project.favorite),
  }));
  return [...generated, ...baseLibrary];
}

function libraryArt(item, className = 'library-art') {
  if (item.outputUrl) {
    const media = item.type === 'video'
      ? `<video src="${escapeHtml(item.outputUrl)}" muted loop autoplay playsinline></video>`
      : `<img src="${escapeHtml(item.outputUrl)}" alt="${escapeHtml(item.title)}" />`;
    return `<span class="${className} output-library">${media}</span>`;
  }
  return `<span class="${className} ${item.art || 'art-glasshouse'}">${artMarkup[item.key] || artMarkup[item.art?.replace('art-', '')] || artMarkup.glasshouse}</span>`;
}

function renderLibrary() {
  const grid = $('#library-grid');
  if (!grid) return;
  const items = allLibraryItems().filter((item) => state.libraryFilter === 'all' || item.type === state.libraryFilter);
  grid.innerHTML = items.map((item) => `
    <article class="library-card" data-library-id="${escapeHtml(item.id || item.key)}" data-library-key="${escapeHtml(item.key)}" data-library-type="${escapeHtml(item.type)}">
      ${libraryArt(item)}
      <button class="favorite-toggle${item.favorite ? ' is-favorite' : ''}" type="button" aria-label="${item.favorite ? 'Remove from favorites' : 'Add to favorites'}" data-favorite-id="${escapeHtml(item.id || item.key)}">${icon('star', 13)}</button>
      <div class="library-info"><span><strong>${escapeHtml(item.title)}</strong><small>${item.type === 'video' ? 'Video' : 'Image'} · ${escapeHtml(item.meta)}</small></span><button class="library-open" type="button" aria-label="Open ${escapeHtml(item.title)}" data-open-id="${escapeHtml(item.id || item.key)}">${icon('arrow-up-right', 13)}</button></div>
    </article>`).join('');
  if (!items.length) grid.innerHTML = '<div class="library-empty">Nothing here yet.</div>';
}

function projectFromId(id) {
  return state.projects.find((project) => project.id === id) || null;
}

function openLibraryItem(id, key) {
  const project = projectFromId(id);
  if (project) {
    state.activeProject = project;
    setMediaType(project.kind);
    if (project.source) setSource(project.source);
    if (project.prompt) $('#prompt').value = project.prompt;
    renderArt(project.art || 'glasshouse', project.outputUrl, project.kind);
    setPreviewCopy(project.title || titleFromPrompt(project.prompt), project.prompt);
    if (project.status === 'complete') setCompletedUi(project);
    else setGeneratingUi(true, project.status || 'rendering');
  } else {
    selectSeed(key || 'glasshouse');
  }
  updatePromptCount();
  switchView('create');
}

function updateConnectionUI() {
  const connection = $('#api-connection');
  const label = $('#connection-label');
  const detail = $('#connection-detail');
  connection.classList.toggle('is-demo', !state.connected);
  if (state.connected) {
    label.textContent = 'Magic Hour connected';
    detail.textContent = 'Server-side API key';
    $('#modal-status-title').textContent = 'Magic Hour is connected';
    $('#modal-status-copy').textContent = 'Your key is available to the local server.';
  } else {
    label.textContent = 'Demo mode';
    detail.textContent = 'Add a server key to connect';
    $('#modal-status-title').textContent = 'Demo mode is active';
    $('#modal-status-copy').textContent = 'Add MAGIC_HOUR_API_KEY to .env to enable renders.';
  }
}

async function loadModels() {
  const status = $('.model-catalog-status');
  status?.classList.add('is-loading');
  try {
    const response = await fetch('/api/models');
    const payload = await response.json();
    if (!response.ok || !Array.isArray(payload.models) || !payload.models.length) throw new Error('Model catalog unavailable');
    state.models = payload.models;
    saveModelCatalog();
    loadModelChoice();
  } catch {
    state.models = loadStoredModelCatalog() || [defaultModelRecord()];
  } finally {
    state.modelsLoaded = true;
    status?.classList.remove('is-loading');
    renderModelOptions();
    refreshModelSettings();
    updateModelDetails();
    renderModelCatalog();
  }
}

async function loadConnection() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    state.connected = Boolean(config.configured);
    state.configLoaded = true;
    updateConnectionUI();
    if (state.connected) {
      try {
        const accountResponse = await fetch('/api/account');
        const account = await accountResponse.json();
        if (accountResponse.ok && account.credits !== undefined) $('#credits-value').textContent = formatCredits(account.credits);
        else $('#credits-value').textContent = '—';
      } catch {
        $('#credits-value').textContent = '—';
      }
    } else {
      $('#credits-value').textContent = 'Demo';
    }
  } catch {
    state.configLoaded = true;
    state.connected = false;
    updateConnectionUI();
    $('#credits-value').textContent = 'Demo';
  }
}

async function requestGeneration(payload) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Magic Hour could not start this render.');
  return data;
}

function wait(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

async function pollProject(project) {
  let attempts = 0;
  while (attempts < 90) {
    await wait(attempts === 0 ? 3000 : 5000);
    attempts += 1;
    const response = await fetch(`/api/projects/${project.kind}/${encodeURIComponent(project.id)}`);
    const details = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(details.error || 'Could not check project status.');
    const status = details.status || 'rendering';
    const outputUrl = details.downloads?.[0]?.url || null;
    const updated = {
      ...project,
      ...details,
      status,
      outputUrl,
      creditsCharged: details.credits_charged || project.creditsCharged,
      title: project.title,
    };
    upsertProject(updated);
    state.activeProject = updated;
    if (status === 'complete') {
      setCompletedUi(updated);
      showToast(`${project.kind === 'video' ? 'Video' : 'Image'} ready in your shelf.`);
      return;
    }
    if (['error', 'canceled', 'cancelled'].includes(status)) {
      throw new Error(details.error || 'Magic Hour could not finish this render.');
    }
    setGeneratingUi(true, status);
  }
  throw new Error('This render is taking longer than expected. Check your Magic Hour shelf shortly.');
}

function demoProject(payload) {
  const seed = payload.mediaType === 'video' ? (payload.source === 'image' ? 'atelier' : 'velvet') : 'glasshouse';
  return {
    id: `demo-${Date.now()}`,
    kind: payload.mediaType,
    source: payload.source,
    model: payload.model,
    prompt: payload.prompt,
    title: titleFromPrompt(payload.prompt),
    status: 'complete',
    art: `art-${seed}`,
    seed,
    outputUrl: null,
    createdAt: new Date().toISOString(),
  };
}

async function handleGenerate(event) {
  event.preventDefault();
  if (state.generating) return;
  const prompt = $('#prompt').value.trim();
  if (!prompt) {
    $('#prompt').focus();
    showToast('Add a prompt before generating.', 'error');
    return;
  }
  if (state.mediaType === 'video' && state.source === 'image' && !state.imageData) {
    showToast('Add a starting image to animate.', 'error');
    $('#upload-dropzone').focus();
    return;
  }

  const payload = {
    kind: state.mediaType,
    mediaType: state.mediaType,
    source: state.source,
    model: state.model,
    prompt,
    aspectRatio: state.ratio,
    resolution: state.quality,
    duration: state.duration,
    audio: state.audio,
    imageData: state.source === 'image' ? state.imageData : null,
  };
  setPreviewCopy(titleFromPrompt(prompt), 'Magic Hour is turning your words into a frame.');
  renderArt(state.mediaType === 'video' ? (state.source === 'image' ? 'atelier' : 'velvet') : 'glasshouse');
  setGeneratingUi(true, 'queued');

  try {
    if (!state.connected) {
      await wait(1700);
      const demo = demoProject(payload);
      state.activeProject = demo;
      upsertProject(demo);
      setCompletedUi(demo);
      showToast('Demo render complete — connect Magic Hour for live output.', 'demo');
      return;
    }

    const result = await requestGeneration(payload);
    const project = {
      ...result,
      id: result.id,
      kind: state.mediaType,
      source: state.source,
      model: result.model || state.model,
      prompt,
      title: titleFromPrompt(prompt),
      status: 'queued',
      art: state.mediaType === 'video' ? (state.source === 'image' ? 'art-atelier' : 'art-velvet') : 'art-glasshouse',
      seed: state.mediaType === 'video' ? (state.source === 'image' ? 'atelier' : 'velvet') : 'glasshouse',
      outputUrl: null,
    };
    state.activeProject = project;
    upsertProject(project);
    showToast('Render queued. We will keep an eye on it.');
    await pollProject(project);
  } catch (error) {
    state.generating = false;
    $('#generate-button').disabled = false;
    $('#preview-loading').hidden = true;
    $('#preview-art').classList.remove('is-dimmed');
    $('#render-status').className = 'render-status is-error';
    $('#render-status-label').textContent = 'Could not render';
    showToast(error.message || 'Something went wrong.', 'error');
  } finally {
    if (!state.generating) $('#generate-button').disabled = false;
  }
}

function setFile(file) {
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    showToast('Please choose a PNG, JPG, or WEBP image.', 'error');
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    showToast('That image is larger than 15 MB.', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    state.imageData = reader.result;
    $('#upload-dropzone').hidden = true;
    $('#uploaded-file').hidden = false;
    $('#file-name').textContent = file.name;
    $('#file-thumb').style.backgroundImage = `url("${reader.result}")`;
    showToast('Starting image added.');
  };
  reader.readAsDataURL(file);
}

function removeFile() {
  state.imageData = null;
  $('#reference-input').value = '';
  $('#upload-dropzone').hidden = false;
  $('#uploaded-file').hidden = true;
  $('#file-thumb').style.backgroundImage = '';
}

function resetControls() {
  state.mediaType = 'image';
  state.source = 'text';
  state.quality = '1k';
  state.duration = 5;
  state.audio = true;
  state.model = 'default';
  saveModelChoice();
  removeFile();
  $('#prompt').value = defaultPrompt;
  $('#duration').value = '5';
  $('#audio-toggle').classList.add('is-on');
  $('#audio-toggle').setAttribute('aria-checked', 'true');
  updatePromptCount();
  updateMediaUI();
  updateRatio('1:1');
  renderArt('glasshouse');
  setPreviewCopy('Glasshouse above the clouds', 'A quiet place to grow wild ideas.');
  setGeneratingUi(false);
  $('#render-status-label').textContent = 'Ready to create';
  showToast('Controls reset.');
}

function switchView(viewName) {
  const valid = ['create', 'library', 'favorites'].includes(viewName) ? viewName : 'create';
  ['create', 'library', 'favorites'].forEach((name) => { $(`#${name}-view`).hidden = name !== valid; });
  $$('.nav-item[data-view-target]').forEach((item) => item.classList.toggle('is-active', item.dataset.viewTarget === valid));
  const labels = { create: 'New creation', library: 'Library', favorites: 'Favorites' };
  $('#breadcrumb-current').textContent = labels[valid];
  if (valid === 'library') renderLibrary();
}

function openModal() {
  $('#modal-backdrop').hidden = false;
  $('#modal-done').focus();
}
function closeModal() { $('#modal-backdrop').hidden = true; }

function bindEvents() {
  mountIcons();
  $('#prompt').addEventListener('input', updatePromptCount);
  $('#generation-form').addEventListener('submit', handleGenerate);
  $$('.media-toggle-button').forEach((button) => button.addEventListener('click', () => setMediaType(button.dataset.mediaType)));
  $$('.source-button').forEach((button) => button.addEventListener('click', () => setSource(button.dataset.source)));
  $$('.ratio-button').forEach((button) => button.addEventListener('click', () => updateRatio(button.dataset.ratio)));
  $('#model-select').addEventListener('change', (event) => {
    state.model = event.target.value || 'default';
    saveModelChoice();
    refreshModelSettings();
    updateModelDetails();
    showToast(`${getActiveModel().name} selected.`);
  });
  $('#quality').addEventListener('change', (event) => { state.quality = event.target.value; setPreviewTypeLabel(); });
  $('#duration').addEventListener('change', (event) => { state.duration = Number(event.target.value); setPreviewTypeLabel(); });
  $('#audio-toggle').addEventListener('click', () => {
    state.audio = !state.audio;
    $('#audio-toggle').classList.toggle('is-on', state.audio);
    $('#audio-toggle').setAttribute('aria-checked', String(state.audio));
  });
  $$('.prompt-suggestions button').forEach((button) => button.addEventListener('click', () => {
    $('#prompt').value = button.dataset.prompt;
    updatePromptCount();
    $('#prompt').focus();
  }));
  $('#prompt-spark').addEventListener('click', () => {
    const prompt = $('#prompt').value.trim();
    if (!prompt) return showToast('Write a little something first.', 'error');
    if (!prompt.includes('intentional composition')) $('#prompt').value = `${prompt.replace(/[.\s]+$/, '')}.${promptEnhancement}`;
    updatePromptCount();
    showToast('Prompt given a little polish.');
  });
  $('#reset-button').addEventListener('click', resetControls);
  $('#browse-models').addEventListener('click', openModelCatalog);
  $('#model-modal-close').addEventListener('click', closeModelCatalog);
  $('#model-modal-backdrop').addEventListener('click', (event) => { if (event.target === $('#model-modal-backdrop')) closeModelCatalog(); });
  $$('.model-filter').forEach((button) => button.addEventListener('click', () => {
    $$('.model-filter').forEach((filterButton) => {
      const isActive = filterButton === button;
      filterButton.classList.toggle('is-active', isActive);
      filterButton.setAttribute('aria-selected', String(isActive));
    });
    renderModelCatalog(button.dataset.modelFilter, $('#model-search').value);
  }));
  $('#model-search').addEventListener('input', (event) => {
    renderModelCatalog($('.model-filter.is-active')?.dataset.modelFilter || 'all', event.target.value);
  });
  $('#model-catalog-grid').addEventListener('click', (event) => {
    const button = event.target.closest('[data-use-model]');
    if (!button || button.disabled) return;
    const model = state.models.find((entry) => entry.id === button.dataset.useModel);
    if (!model || !modelIsAvailable(model)) return showToast('Switch the output type to use that model.', 'error');
    state.model = model.id;
    saveModelChoice();
    $('#model-select').value = model.id;
    refreshModelSettings();
    updateModelDetails();
    closeModelCatalog();
    showToast(`${model.name} selected.`);
  });
  $('#upload-dropzone').addEventListener('click', () => $('#reference-input').click());
  $('#reference-input').addEventListener('change', (event) => setFile(event.target.files?.[0]));
  $('#remove-file').addEventListener('click', removeFile);
  $('#upload-dropzone').addEventListener('dragover', (event) => { event.preventDefault(); });
  $('#upload-dropzone').addEventListener('drop', (event) => { event.preventDefault(); setFile(event.dataTransfer.files?.[0]); });
  $$('.creation-card').forEach((card) => card.addEventListener('click', () => selectSeed(card.dataset.seed)));
  $$('[data-view-target]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.viewTarget)));
  $$('.library-tab').forEach((button) => button.addEventListener('click', () => {
    state.libraryFilter = button.dataset.libraryFilter;
    $$('.library-tab').forEach((tab) => tab.classList.toggle('is-active', tab === button));
    renderLibrary();
  }));
  $('#library-grid').addEventListener('click', (event) => {
    const favoriteButton = event.target.closest('[data-favorite-id]');
    if (favoriteButton) {
      event.stopPropagation();
      const project = projectFromId(favoriteButton.dataset.favoriteId);
      if (project) {
        project.favorite = !project.favorite;
        persistProjects();
        renderLibrary();
        showToast(project.favorite ? 'Saved to favorites.' : 'Removed from favorites.');
      } else showToast('Seed creations are for inspiration.');
      return;
    }
    const openButton = event.target.closest('[data-open-id]');
    const card = event.target.closest('[data-library-id]');
    if (openButton || card) openLibraryItem(openButton?.dataset.openId || card.dataset.libraryId, card?.dataset.libraryKey);
  });
  $('#connection-help').addEventListener('click', openModal);
  $('#help-button').addEventListener('click', openModal);
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal-done').addEventListener('click', closeModal);
  $('#modal-backdrop').addEventListener('click', (event) => { if (event.target === $('#modal-backdrop')) closeModal(); });
  $('#command-button').addEventListener('click', () => { $('#prompt').focus(); switchView('create'); });
  $('#expand-preview').addEventListener('click', () => {
    const stage = $('#preview-stage');
    if (document.fullscreenElement) document.exitFullscreen?.();
    else if (stage.requestFullscreen) stage.requestFullscreen().catch(() => showToast('Fullscreen is not available here.', 'error'));
    else showToast('Fullscreen is not available here.', 'error');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { closeModal(); closeModelCatalog(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      $('#prompt').focus();
      switchView('create');
    }
  });
}

function init() {
  readStoredProjects();
  loadModelChoice();
  state.models = loadStoredModelCatalog() || [];
  $('#recent-count').textContent = String(4 + state.projects.length);
  bindEvents();
  updatePromptCount();
  updateMediaUI();
  updateRatio('1:1');
  renderLibrary();
  setTimeout(() => { loadModels(); loadConnection(); }, 40);
}

init();
