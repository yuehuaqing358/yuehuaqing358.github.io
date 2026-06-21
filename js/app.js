(() => {
  'use strict';

  var DATA = window.BLOG_DATA || {};
  var POSTS = DATA.POSTS || [];
  var ABOUT = DATA.ABOUT || {};
  var PRODUCTS = DATA.PRODUCTS || [];
  var CONTACT = DATA.CONTACT || {};
  var SECRET_PASSWORD = 'elj2026';  /* ← 改这里换密码 */
  var isSecretUnlocked = false;

  /* GitHub API 配置（用于便签功能） */
  var GITHUB_REPO = 'yuehuaqing358/yuehuaqing358.github.io';
  var GITHUB_BRANCH = 'main';
  var GITHUB_NOTES_PATH = 'secret-notes';

  function getGitHubToken() {
    return localStorage.getItem('gh_token') || '';
  }
  function setGitHubToken(t) {
    if (t) localStorage.setItem('gh_token', t);
    else localStorage.removeItem('gh_token');
  }

  /* 安全 base64 编解码（支持中文） */
  function utf8_to_b64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64_to_utf8(str) {
    return decodeURIComponent(escape(atob(str)));
  }

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  function parseMarkdown(md) {
    if (typeof marked !== 'undefined' && marked.parse) {
      try { return marked.parse(md.trim()); } catch (e) {}
    }
    return md.trim()
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .split('\n\n').map(function(block) {
        var t = block.trim();
        if (/^#{2,3}\s/.test(t)) return '<h3 style="margin-top:1.5em">' + t.replace(/^#{2,3}\s*/, '') + '</h3>';
        if (/^#\s/.test(t)) return '<h2 style="margin-top:1.5em">' + t.replace(/^#\s*/, '') + '</h2>';
        if (t.startsWith('---')) return '<hr>';
        if (t.startsWith('- ') || t.startsWith('* ')) return '<ul>' + t.split('\n').map(function(l) { return '<li>' + l.replace(/^[-*]\s*/, '') + '</li>'; }).join('') + '</ul>';
        if (/^\d+\.\s/.test(t)) return '<ol>' + t.split('\n').map(function(l) { return '<li>' + l.replace(/^\d+\.\s*/, '') + '</li>'; }).join('') + '</ol>';
        return '<p>' + t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') + '</p>';
      }).join('\n');
  }

  function formatDate(s) {
    var d = new Date(s);
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function getAllTags() {
    var m = {};
    POSTS.forEach(function(p) { p.tags.forEach(function(t) { m[t] = (m[t] || 0) + 1; }); });
    return m;
  }

  function renderTag(tag, active) {
    return '<span class="tag' + (active ? ' active' : '') + '" data-tag="' + tag + '">' + tag + '</span>';
  }

  function renderPostCard(post) {
    return '<article class="post-card" data-id="' + post.id + '">' +
      '<div class="post-card-meta">' +
        '<span class="post-date">' + formatDate(post.date) + '</span>' +
        post.tags.map(function(t) { return renderTag(t); }).join('') +
      '</div>' +
      '<h3>' + post.title + '</h3>' +
      '<p>' + post.summary + '</p>' +
      '<div class="post-card-footer">' +
        '<span class="read-time">阅读约 ' + post.readTime + '</span>' +
        '<span style="font-size:12px;color:var(--primary)">阅读全文 →</span>' +
      '</div>' +
    '</article>';
  }

  /* ── 路由 ── */
  var NAV_PAGES = ['home', 'services', 'articles', 'contact'];
  var ALL_PAGES = NAV_PAGES.concat(['article', 'service', 'secret']);
  var currentPage = 'home';

  function showPage(name) {
    $$('.page').forEach(function(p) { p.classList.remove('active'); });
    var el = $('#page-' + name);
    if (el) el.classList.add('active');

    $$('.bottom-nav-item').forEach(function(a) {
      a.classList.toggle('active', a.getAttribute('data-page') === name);
    });

    if (name === 'secret') loadNotes();

    currentPage = name;
    window.scrollTo(0, 0);
  }

  function navigate(name) {
    if (NAV_PAGES.indexOf(name) !== -1) {
      history.pushState({ page: name }, '', '#' + name);
    }
    showPage(name);
  }

  window.addEventListener('popstate', function(e) {
    var p = (e.state && e.state.page) || 'home';
    showPage(ALL_PAGES.indexOf(p) !== -1 ? p : 'home');
  });

  /* ── 绑定导航 ── */
  function bindNav() {
    $$('.bottom-nav-item').forEach(function(a) {
      a.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        navigate(a.getAttribute('data-page'));
      });
    });

    var homeServicesCard = $('.home-services-card');
    if (homeServicesCard) {
      homeServicesCard.addEventListener('click', function(e) {
        e.preventDefault();
        navigate(homeServicesCard.getAttribute('data-page'));
      });
    }

  }

  /* ── 密码弹窗 ── */
  function showPwdModal() {
    var overlay = $('#pwd-overlay');
    if (!overlay) return;
    overlay.classList.add('show');
    var input = $('#pwd-input');
    if (input) { input.value = ''; input.focus(); }
    var err = $('#pwd-error');
    if (err) err.classList.remove('show');
  }

  function hidePwdModal() {
    var overlay = $('#pwd-overlay');
    if (overlay) overlay.classList.remove('show');
  }

  function checkPassword() {
    var input = $('#pwd-input');
    if (!input) return;
    if (input.value === SECRET_PASSWORD) {
      isSecretUnlocked = true;
      hidePwdModal();
      navigate('secret');
    } else {
      var err = $('#pwd-error');
      if (err) err.classList.add('show');
      input.value = '';
      input.focus();
    }
  }

  /* ══ 专属空间·便签本 ══ */
  var currentNoteId = null;   /* 当前正在编辑的便签文件名（不含路径）*/
  var notesList = [];        /* 缓存的便签列表 */

  /* 加载便签列表 */
  function loadNotes() {
    if (!isSecretUnlocked) return;
    showNoteList();

    fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + GITHUB_NOTES_PATH, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    .then(function(r) {
      if (r.status === 404) return [];
      return r.json();
    })
    .then(function(data) {
      if (!Array.isArray(data)) {
        notesList = [];
      } else {
        notesList = data.filter(function(f) { return f.name.endsWith('.md'); }).map(function(f) {
          return { id: f.name.replace(/\.md$/, ''), name: f.name, sha: f.sha, url: f.html_url };
        });
      }
      renderNotesList();
    })
    .catch(function() { notesList = []; renderNotesList(); });
  }

  /* 渲染便签列表 */
  function renderNotesList() {
    var grid = $('#notes-grid');
    var empty = $('#notes-empty');
    if (!grid) return;

    /* 保留「新建」卡片，清空其余 */
    var addCard = $('#note-add-btn');
    grid.innerHTML = '';
    if (addCard) grid.appendChild(addCard);

    if (notesList.length === 0) {
      if (empty) empty.classList.add('show');
    } else {
      if (empty) empty.classList.remove('show');
      /* 按文件名倒序（新的在前）*/
      notesList.slice().sort(function(a, b) { return b.id.localeCompare(a.id); }).forEach(function(note) {
        var card = document.createElement('div');
        card.className = 'note-card';
        card.setAttribute('data-note-id', note.id);

        var ts = note.id.replace('note-', '');
        var d = new Date(parseInt(ts, 10));
        var dateStr = d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

        card.innerHTML =
          '<div class="note-card-title">未命名便签</div>' +
          '<div class="note-card-preview"></div>' +
          '<div class="note-card-date">' + dateStr + '</div>';

        card.addEventListener('click', function() { openNote(note.id); });
        grid.appendChild(card);

        /* 异步读取标题和预览 */
        loadNoteMeta(note.id, card);
      });
    }
  }

  /* 异步读取便签的标题和预览文本 */
  function loadNoteMeta(noteId, card) {
    fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + GITHUB_NOTES_PATH + '/' + noteId + '.md', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.content) return;
      var raw = b64_to_utf8(data.content);
      var match = raw.match(/^---\s*\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
      var title = '';
      var content = raw;
      if (match) {
        var fm = match[1];
        var fmMatch = fm.match(/^title:\s*(.+)$/m);
        if (fmMatch) title = fmMatch[1].trim();
        content = match[2];
      }
      var tEl = card.querySelector('.note-card-title');
      var pEl = card.querySelector('.note-card-preview');
      if (tEl) tEl.textContent = title || '未命名便签';
      if (pEl) pEl.textContent = content.trim().split('\n')[0] || '';
    })
    .catch(function() {});
  }

  /* 显示列表视图 */
  function showNoteList() {
    var listEl = $('#secret-notes-view');
    var editEl = $('#secret-note-edit');
    if (listEl) listEl.style.display = '';
    if (editEl) editEl.style.display = 'none';
  }

  /* 显示编辑视图 */
  function showNoteEdit() {
    var listEl = $('#secret-notes-view');
    var editEl = $('#secret-note-edit');
    if (listEl) listEl.style.display = 'none';
    if (editEl) editEl.style.display = '';
  }

  /* 打开便签（读取内容）*/
  function openNote(noteId) {
    currentNoteId = noteId;
    showNoteEdit();
    var titleInput = $('#note-title-input');
    var contentInput = $('#note-content-input');
    var dateEl = $('#note-edit-date');
    if (titleInput) titleInput.value = '';
    if (contentInput) contentInput.value = '加载中…';

    var ts = noteId.replace('note-', '');
    var d = new Date(parseInt(ts, 10));
    if (dateEl) dateEl.textContent = '创建于 ' + d.toLocaleString('zh-CN', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });

    fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + GITHUB_NOTES_PATH + '/' + noteId + '.md', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.content) return;
      var raw = b64_to_utf8(data.content);
      var match = raw.match(/^---\s*\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
      var title = '';
      var content = raw;
      if (match) {
        var fm = match[1];
        var fmMatch = fm.match(/^title:\s*(.+)$/m);
        if (fmMatch) title = fmMatch[1].trim();
        content = match[2];
      }
      if (titleInput) titleInput.value = title;
      if (contentInput) contentInput.value = content;
    })
    .catch(function() {
      if (contentInput) contentInput.value = '';
    });
  }

  /* 新建便签 */
  function createNote() {
    currentNoteId = null;
    showNoteEdit();
    var titleInput = $('#note-title-input');
    var contentInput = $('#note-content-input');
    var dateEl = $('#note-edit-date');
    if (titleInput) titleInput.value = '';
    if (contentInput) contentInput.value = '';
    if (dateEl) dateEl.textContent = '新建便签';
  }

  /* 保存便签 */
  function saveNote() {
    var token = getGitHubToken();
    if (!token) { showTokenModal(); return; }
    doSaveNote(token);
  }

  function doSaveNote(token) {
    var titleInput = $('#note-title-input');
    var contentInput = $('#note-content-input');
    if (!contentInput) return;
    var title = titleInput ? titleInput.value.trim() : '';
    var content = contentInput.value;
    var saveBtn = $('#note-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '保存中…'; }

    var fileName, fileContent;
    fileName = (currentNoteId || ('note-' + Date.now())) + '.md';
    fileContent = '---\ntitle: ' + title + '\ncreated: ' + new Date().toISOString() + '\n---\n\n' + content;

    function finishSave() {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '保存'; }
      alert('保存成功！');
      loadNotes();
    }

    function handleErr(err) {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '保存'; }
      alert('保存失败：' + (err && err.message ? err.message : '请重试'));
    }

    if (currentNoteId) {
      /* 更新已有便签：先获取 SHA */
      fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + GITHUB_NOTES_PATH + '/' + fileName, {
        headers: { 'Authorization': 'token ' + token, 'User-Agent': 'Mozilla/5.0' }
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        return fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + GITHUB_NOTES_PATH + '/' + fileName, {
          method: 'PUT',
          headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
          body: JSON.stringify({ message: '更新便签', content: utf8_to_b64(fileContent), sha: data.sha, branch: GITHUB_BRANCH })
        });
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.commit) finishSave();
        else throw new Error(data.message || '保存失败');
      })
      .catch(handleErr);
    } else {
      /* 新建便签 */
      currentNoteId = fileName.replace(/\.md$/, '');
      fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + GITHUB_NOTES_PATH + '/' + fileName, {
        method: 'PUT',
        headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ message: '新建便签', content: utf8_to_b64(fileContent), branch: GITHUB_BRANCH })
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.content) finishSave();
        else throw new Error(data.message || '保存失败');
      })
      .catch(handleErr);
    }
  }

  /* 删除便签 */
  function deleteNote() {
    if (!currentNoteId) return;
    if (!confirm('确定要删除这个便签吗？删除后无法恢复。')) return;
    var token = getGitHubToken();
    if (!token) { showTokenModal(); return; }

    var fileName = currentNoteId + '.md';
    fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + GITHUB_NOTES_PATH + '/' + fileName, {
      headers: { 'Authorization': 'token ' + token, 'User-Agent': 'Mozilla/5.0' }
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      return fetch('https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + GITHUB_NOTES_PATH + '/' + fileName, {
        method: 'DELETE',
        headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({ message: '删除便签', sha: data.sha, branch: GITHUB_BRANCH })
      });
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.commit) {
        alert('删除成功！');
        currentNoteId = null;
        loadNotes();
      } else throw new Error(data.message || '删除失败');
    })
    .catch(function(err) { alert('删除失败：' + (err.message || '请重试')); });
  }

  /* Token 弹窗 */
  function showTokenModal() {
    var overlay = $('#token-overlay');
    if (!overlay) return;
    overlay.classList.add('show');
    var input = $('#token-input');
    if (input) { input.value = ''; input.focus(); }
    var err = $('#token-error');
    if (err) err.classList.remove('show');
  }
  function hideTokenModal() {
    var overlay = $('#token-overlay');
    if (overlay) overlay.classList.remove('show');
  }

  /* 双击头像绑定 */
  function bindAvatarDblClick() {
    var avatar = $('.contact-avatar');
    if (avatar) {
      avatar.style.cursor = 'default';
      avatar.addEventListener('dblclick', function(e) {
        e.preventDefault();
        e.stopPropagation();
        showPwdModal();
      });
    }
  }

  /* ── 服务页 ── */
  function renderServices() {
    var container = $('#services-list');
    if (!container) return;
    container.innerHTML = PRODUCTS.map(function(p) {
      var featuresHtml = (p.features || []).map(function(f) {
        return '<li>' + f + '</li>';
      }).join('');

      return '<div class="service-card">' +
        '<div class="service-card-header">' +
          '<span class="service-icon">' + (p.icon || '') + '</span>' +
          '<h4>' + p.name + '</h4>' +
        '</div>' +
        '<p class="service-desc">' + p.desc + '</p>' +
        (featuresHtml ? '<ul class="service-features">' + featuresHtml + '</ul>' : '') +
        '<div class="service-card-footer">' +
          '<div class="service-price">' +
            '<span class="price-symbol">¥</span>' +
            '<span class="price-num">' + p.price + '</span>' +
            '<span class="price-unit">' + p.priceUnit + '</span>' +
          '</div>' +
          '<a class="service-cta">' + (p.cta || '预约咨询') + ' →</a>' +
        '</div>' +
      '</div>';
    }).join('');

    $$('.service-cta', container).forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        navigate('contact');
      });
    });
  }

  /* ── 文章页 ── */
  var activeFilter = null;

  function renderArticles(filterTag) {
    activeFilter = filterTag || null;
    var container = $('#all-posts');
    if (!container) return;

    var filtered = filterTag ? POSTS.filter(function(p) { return p.tags.indexOf(filterTag) !== -1; }) : POSTS;

    if (filtered.length === 0) {
      container.innerHTML = '<div class="empty">暂无文章，敬请期待…</div>';
      return;
    }
    container.innerHTML = filtered.map(renderPostCard).join('');
    bindPostCards(container);

    $$('#filter-chips .tag').forEach(function(c) {
      c.classList.toggle('active', c.getAttribute('data-tag') === (filterTag || ''));
    });
  }

  function bindPostCards(container) {
    $$('.post-card', container).forEach(function(card) {
      card.addEventListener('click', function(e) {
        var tagEl = e.target.closest('.tag');
        if (tagEl) {
          e.stopPropagation();
          renderArticles(tagEl.getAttribute('data-tag'));
          return;
        }
        openArticle(parseInt(card.getAttribute('data-id'), 10));
      });
    });
  }

  function buildFilterChips() {
    var wrap = $('#filter-chips');
    if (!wrap) return;
    var tags = getAllTags();
    var sorted = Object.keys(tags).sort(function(a, b) { return tags[b] - tags[a]; });
    wrap.innerHTML = '<span class="tag" data-tag="">全部</span>' +
      sorted.map(function(t) { return '<span class="tag" data-tag="' + t + '">' + t + '</span>'; }).join('');
    $$('.tag', wrap).forEach(function(el) {
      el.addEventListener('click', function() {
        renderArticles(el.getAttribute('data-tag') || null);
      });
    });
  }

  function bindSearch() {
    var inp = $('#search-input');
    if (!inp) return;
    inp.addEventListener('input', function() {
      var q = inp.value.trim().toLowerCase();
      if (!q) { renderArticles(activeFilter); return; }
      var filtered = POSTS.filter(function(p) {
        return p.title.toLowerCase().indexOf(q) !== -1 ||
               p.summary.toLowerCase().indexOf(q) !== -1 ||
               p.tags.some(function(t) { return t.toLowerCase().indexOf(q) !== -1; });
      });
      var container = $('#all-posts');
      container.innerHTML = filtered.length
        ? filtered.map(renderPostCard).join('')
        : '<div class="empty">没有找到"' + q + '"相关的文章</div>';
      if (filtered.length) bindPostCards(container);
    });
  }

  /* ── 文章详情 ── */
  function openArticle(id) {
    var post = POSTS.filter(function(p) { return p.id === id; })[0];
    if (!post) return;

    var html = parseMarkdown(post.content);
    var toc = buildTOC(post.content);

    $('#article-container').innerHTML =
      '<button class="back-btn" id="btn-back">← 返回</button>' +
      '<div class="article-header">' +
        '<h1 class="article-title">' + post.title + '</h1>' +
        '<div class="article-meta">' +
          '<span>' + formatDate(post.date) + '</span><span>·</span>' +
          '<span>阅读约 ' + post.readTime + '</span><span>·</span>' +
          post.tags.map(function(t) { return renderTag(t); }).join('') +
        '</div>' +
      '</div>' +
      (toc ? '<div class="toc"><div class="toc-title">目录</div>' + toc + '</div>' : '') +
      '<div class="md-content">' + html + '</div>';

    $('#btn-back').addEventListener('click', function() {
      history.back();
      setTimeout(function() { if (currentPage === 'article') navigate('articles'); }, 100);
    });

    navigate('article');
  }

  /* ── 服务详情 ── */
  function openService(id) {
    var service = PRODUCTS.filter(function(p) { return p.id === id; })[0];
    if (!service) return;

    var html = parseMarkdown(service.content);

    $('#service-container').innerHTML =
      '<button class="back-btn" id="btn-svc-back">← 返回</button>' +
      '<div class="article-header"><h1 class="article-title">' + service.name + '</h1></div>' +
      '<div class="md-content">' + html + '</div>';

    $('#btn-svc-back').addEventListener('click', function() {
      history.back();
      setTimeout(function() { if (currentPage === 'service') navigate('services'); }, 100);
    });

    navigate('service');
  }

  function buildTOC(md) {
    var headings = [];
    md.split('\n').forEach(function(line) {
      var m = line.match(/^(#{2,3})\s+(.+)/);
      if (m) headings.push({ level: m[1].length, text: m[2].trim() });
    });
    if (headings.length < 2) return '';
    return '<ul>' + headings.map(function(h) {
      return '<li' + (h.level === 3 ? ' style="margin-left:1em"' : '') + '>' + h.text + '</li>';
    }).join('') + '</ul>';
  }

  /* ── 联系页 ── */
  function renderContact() {
    var container = $('#contact-full');
    if (!container) return;

    var bioHtml = ABOUT.bio ? ABOUT.bio.split('\n\n').map(function(p) { return '<p>' + p + '</p>'; }).join('') : '';

    container.innerHTML =
      '<div class="contact-bio-card">' +
        '<div class="contact-avatar">' + (ABOUT.name || 'E')[0] + '</div>' +
        '<div class="contact-name">' + (ABOUT.name || '') + '</div>' +
        '<div class="contact-role">' + (ABOUT.title || '') + '</div>' +
        '<div class="contact-bio-text">' + bioHtml + '</div>' +
      '</div>' +
      '<div class="contact-cards">' +
        '<div class="contact-card">' +
          '<span class="contact-card-icon wechat-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.952-7.062-6.122zm-2.18 2.769c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z"/></svg></span>' +
          '<div class="contact-card-body"><span class="contact-card-label">微信</span><span class="contact-card-value">' + (CONTACT.wechat || '') + '</span></div>' +
        '</div>' +
        '<div class="contact-card">' +
          '<span class="contact-card-icon oa-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8l4 4-4 4"/></svg></span>' +
          '<div class="contact-card-body"><span class="contact-card-label">公众号</span><span class="contact-card-value">' + (CONTACT.official_account || '') + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="contact-note">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
        (CONTACT.intro || '') +
      '</div>';

    bindAvatarDblClick();
  }

  /* ── 初始化 ── */
  function init() {
    bindNav();
    renderServices();
    buildFilterChips();
    renderArticles();
    bindSearch();
    renderContact();

    /* 密码弹窗事件 */
    var pwdBtn = $('#pwd-btn');
    if (pwdBtn) pwdBtn.addEventListener('click', checkPassword);

    var pwdInput = $('#pwd-input');
    if (pwdInput) pwdInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') checkPassword();
    });

    var pwdCancel = $('#pwd-cancel');
    if (pwdCancel) pwdCancel.addEventListener('click', hidePwdModal);

    var pwdOverlay = $('#pwd-overlay');
    if (pwdOverlay) pwdOverlay.addEventListener('click', function(e) {
      if (e.target === pwdOverlay) hidePwdModal();
    });

    var secretBack = $('#secret-back');
    if (secretBack) secretBack.addEventListener('click', function() { navigate('contact'); });

    /* 便签：新建按钮 */
    var noteAddBtn = $('#note-add-btn');
    if (noteAddBtn) noteAddBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      createNote();
    });

    /* 便签：保存按钮 */
    var noteSaveBtn = $('#note-save-btn');
    if (noteSaveBtn) noteSaveBtn.addEventListener('click', saveNote);

    /* 便签：删除按钮 */
    var noteDeleteBtn = $('#note-delete-btn');
    if (noteDeleteBtn) noteDeleteBtn.addEventListener('click', deleteNote);

    /* 便签：返回按钮（编辑页）*/
    var noteEditBack = $('#note-edit-back');
    if (noteEditBack) noteEditBack.addEventListener('click', function() {
      currentNoteId = null;
      loadNotes();
    });

    /* Token 弹窗事件 */
    var tokenBtn = $('#token-btn');
    if (tokenBtn) tokenBtn.addEventListener('click', function() {
      var input = $('#token-input');
      var token = input ? input.value.trim() : '';
      var err = $('#token-error');
      if (!token.startsWith('ghp_')) {
        if (err) err.classList.add('show');
        return;
      }
      if (err) err.classList.remove('show');
      setGitHubToken(token);
      hideTokenModal();
      /* 继续刚才未完成的保存 */
      doSaveNote(token);
    });

    var tokenInput = $('#token-input');
    if (tokenInput) tokenInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); $('#token-btn').click(); }
    });

    var tokenCancel = $('#token-cancel');
    if (tokenCancel) tokenCancel.addEventListener('click', hideTokenModal);

    var tokenOverlay = $('#token-overlay');
    if (tokenOverlay) tokenOverlay.addEventListener('click', function(e) {
      if (e.target === tokenOverlay) hideTokenModal();
    });

    var hash = (location.hash || '').replace('#', '') || 'home';
    showPage(ALL_PAGES.indexOf(hash) !== -1 ? hash : 'home');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
