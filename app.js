const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  files: [],
  folderName: '',
  directoryHandle: null,
  phoneFileCount: 0
};

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
};

const getExtension = (name) => {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : 'file';
};

const timestamp = () => new Intl.DateTimeFormat([], {
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
}).format(new Date());

function addLog(message, type = '') {
  const row = document.createElement('p');
  if (type) row.className = type;
  const time = document.createElement('time');
  time.textContent = timestamp();
  const text = document.createElement('span');
  text.textContent = message;
  row.append(time, text);
  $('#activityLog').prepend(row);
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2800);
}

function updateSourceCount() {
  const count = (state.files.length ? 1 : 0) + (state.phoneFileCount ? 1 : 0);
  $('#sourceCount').textContent = `${count} / 4`;
}

function renderFiles() {
  const empty = $('#fileEmpty');
  const results = $('#fileResults');
  if (!state.files.length) {
    empty.hidden = false;
    results.hidden = true;
    $('#filePanelTitle').textContent = 'Folder console';
    return;
  }

  empty.hidden = true;
  results.hidden = false;
  $('#filePanelTitle').textContent = state.folderName || 'Selected files';
  $('#fileCount').textContent = state.files.length;
  $('#folderSize').textContent = formatBytes(state.files.reduce((sum, file) => sum + (file.size || 0), 0));
  $('#fileTypes').textContent = new Set(state.files.map(file => getExtension(file.name))).size;

  const list = $('#fileList');
  list.replaceChildren(...state.files.slice(0, 50).map(file => {
    const item = document.createElement('li');
    const type = document.createElement('span');
    type.className = 'file-type';
    type.textContent = getExtension(file.name).slice(0, 4);
    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = file.relativePath || file.name;
    name.title = file.relativePath || file.name;
    const size = document.createElement('span');
    size.className = 'file-size';
    size.textContent = formatBytes(file.size);
    item.append(type, name, size);
    return item;
  }));

  if (state.files.length > 50) {
    const item = document.createElement('li');
    item.textContent = `…and ${state.files.length - 50} more files`;
    item.style.color = '#696c66';
    list.append(item);
  }

  $('#folderStatus').textContent = `${state.folderName || 'Selection'} · ${state.files.length} files`;
  $('#folderAction').textContent = 'Change';
  $('#chooseFolder').classList.add('connected');
  updateSourceCount();
}

async function readDirectory(handle, path = '', files = [], depth = 0) {
  if (depth > 3 || files.length >= 500) return files;
  for await (const entry of handle.values()) {
    if (files.length >= 500) break;
    const relativePath = path ? `${path}/${entry.name}` : entry.name;
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      file.relativePath = relativePath;
      files.push(file);
    } else if (entry.kind === 'directory') {
      await readDirectory(entry, relativePath, files, depth + 1);
    }
  }
  return files;
}

async function chooseLocalFolder() {
  if ('showDirectoryPicker' in window) {
    try {
      addLog('Requesting permission for a local folder.');
      const handle = await window.showDirectoryPicker({ mode: 'read' });
      state.directoryHandle = handle;
      state.folderName = handle.name;
      state.files = await readDirectory(handle);
      renderFiles();
      addLog(`Connected “${handle.name}” with ${state.files.length} visible files.`, 'success');
      toast('Folder connected locally');
    } catch (error) {
      if (error.name === 'AbortError') {
        addLog('Folder selection cancelled.', 'warning');
      } else {
        addLog(`Folder access failed: ${error.message}`, 'warning');
        toast('Folder access was not granted');
      }
    }
    return;
  }
  $('#folderFallback').click();
}

function acceptFileSelection(fileList, label) {
  const files = [...fileList];
  if (!files.length) return;
  state.files = files.map(file => {
    file.relativePath = file.webkitRelativePath || file.name;
    return file;
  });
  state.folderName = label;
  renderFiles();
  addLog(`Selected ${files.length} files using the browser picker.`, 'success');
  toast(`${files.length} local files ready`);
}

function clearSelection() {
  state.files = [];
  state.folderName = '';
  state.directoryHandle = null;
  $('#chooseFolder').classList.remove('connected');
  $('#folderStatus').textContent = 'Not connected';
  $('#folderAction').textContent = 'Choose';
  renderFiles();
  updateSourceCount();
  addLog('Local folder selection cleared.');
}

function showDialog(title, kicker, html, action = 'Got it') {
  $('#dialogTitle').textContent = title;
  $('#dialogKicker').textContent = kicker;
  $('#dialogBody').innerHTML = html;
  $('#dialogAction').textContent = action;
  $('#infoDialog').showModal();
  $('#dialogAction').focus();
}

function connectorDialog(name) {
  showDialog(
    `${name} connection`,
    'SANDBOX CONNECTOR',
    `<p>This presentation does not request account access. A production version would open ${name}’s normal authorization screen and store a revocable connection—not your password.</p><ul><li>You choose the account and permissions.</li><li>The connection can be removed at any time.</li><li>Actions are limited to the automation you approve.</li></ul>`,
    'Keep it in demo mode'
  );
  addLog(`${name} connection preview opened; no account data requested.`);
}

function runFolderAudit() {
  if (!state.files.length) {
    toast('Choose a folder first');
    addLog('Folder health check stopped: no folder selected.', 'warning');
    $('#chooseFolder').focus();
    return;
  }
  const names = state.files.map(file => file.name.toLowerCase());
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  const empty = state.files.filter(file => file.size === 0);
  const hidden = state.files.filter(file => file.name.startsWith('.'));
  addLog(`Folder health check: ${state.files.length} files, ${new Set(duplicates).size} duplicate names, ${empty.length} empty, ${hidden.length} hidden.`, duplicates.length || empty.length ? 'warning' : 'success');
  showDialog(
    'Folder health check complete',
    'LOCAL PYTHON RULESET — SIMULATED',
    `<p>The browser performed the same deterministic checks the Python helper would run.</p><ul><li><strong>${state.files.length}</strong> files inspected</li><li><strong>${new Set(duplicates).size}</strong> duplicate filenames</li><li><strong>${empty.length}</strong> empty files</li><li><strong>${new Set(state.files.map(file => getExtension(file.name))).size}</strong> file types</li></ul><p>No files were changed or uploaded.</p>`,
    'Close report'
  );
}

function runAutomation(type) {
  if (type === 'folder') return runFolderAudit();
  const configs = {
    github: ['Repository guardian', 'Would fetch the selected repository, check its branch and local changes, run tests, scan the staged diff for secrets, and verify the deployed URL. No push occurs without approval.'],
    documents: ['Document package validator', 'Would validate filenames, PDF and DOCX structure, required attachments, page counts, and placeholder text. Choose a folder to run the local browser demonstration.'],
    website: ['Website watchdog', 'Would run on a schedule, request the public URL, check assets and links, capture a screenshot, compare it to the last good version, and notify only when something changes.']
  };
  const [title, text] = configs[type];
  showDialog(title, 'AUTOMATION PREVIEW', `<p>${text}</p><p>This sandbox demonstrates the control surface; the deployed page does not contain cloud credentials or a background Python service.</p>`, 'Close preview');
  addLog(`${title} preview opened.`);
}

function initCompatibility() {
  const status = $('#compatibility');
  if ('showDirectoryPicker' in window) {
    status.classList.add('supported');
    status.innerHTML = '<span></span> Full folder picker available in this browser';
  } else {
    status.classList.add('limited');
    status.innerHTML = '<span></span> File upload fallback available; persistent folders need Chrome or Edge desktop';
  }
}

$('#chooseFolder').addEventListener('click', chooseLocalFolder);
$('#chooseFolderHero').addEventListener('click', chooseLocalFolder);
$('#folderFallback').addEventListener('change', event => acceptFileSelection(event.target.files, 'Selected folder'));
$('#phoneFiles').addEventListener('change', event => {
  const files = [...event.target.files];
  state.phoneFileCount = files.length;
  $('#phoneStatus').textContent = files.length ? `${files.length} files selected` : 'Choose files from this device';
  updateSourceCount();
  if (files.length) {
    acceptFileSelection(files, 'Phone inbox');
    addLog(`Phone inbox received ${files.length} locally selected files.`, 'success');
  }
});
$('#clearFiles').addEventListener('click', clearSelection);
$('#clearLog').addEventListener('click', () => {
  $('#activityLog').innerHTML = '<p><time>READY</time><span>Log cleared. Waiting for the next action.</span></p>';
});

$$('[data-connector]').forEach(button => button.addEventListener('click', () => connectorDialog(button.dataset.connector)));
$$('[data-run]').forEach(button => button.addEventListener('click', () => runAutomation(button.dataset.run)));
$$('[data-scroll]').forEach(button => button.addEventListener('click', () => {
  const target = $(`#${button.dataset.scroll}`);
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}));

$('#privacyButton').addEventListener('click', () => showDialog(
  'What stays local?',
  'PRIVACY MODEL',
  '<p>The browser can see only folders or files you deliberately select. This demo analyzes names, types, and sizes in your browser and sends nothing to a server.</p><ul><li>No AI model receives your files.</li><li>No passwords are collected.</li><li>No background folder access is hidden.</li><li>A production local helper would show an audit log for every action.</li></ul>',
  'Understood'
));

function closeDialog() { $('#infoDialog').close(); }
$('#dialogClose').addEventListener('click', closeDialog);
$('#dialogAction').addEventListener('click', closeDialog);
$('#infoDialog').addEventListener('click', event => { if (event.target === $('#infoDialog')) closeDialog(); });

initCompatibility();
renderFiles();
