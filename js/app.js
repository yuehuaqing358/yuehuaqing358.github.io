(() => {
  'use strict';

  var DATA = window.BLOG_DATA || {};
  var POSTS = DATA.POSTS || [];
  var ABOUT = DATA.ABOUT || {};
  var PRODUCTS = DATA.PRODUCTS || [];
  var CONTACT = DATA.CONTACT || {};
  var SECRET_PASSWORD = 'elj2026';  /* ← 改这里换密码 */
  var isSecretUnlocked = false;

  /* Vercel API 基础地址（便签后端，Token 存在云端）*/
  var API_BASE = 'https://earendeljing-api.vercel.app/api/notes';

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
  var currentNoteId = null;
  var notesList = [];

  /* 加载便签列表（调用 Vercel API，无需 Token）*/
  function loadNotes() {
    if (!isSecretUnlocked) return;
    showNoteList();

    fetch(API_BASE)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        notesList = Array.isArray(data) ? data : [];
        renderNotesList();
      })
      .catch(function() { notesList = []; renderNotesList(); });
  }

  /* 渲染便签列表 */
  function renderNotesList() {
    var grid = $('#notes-grid');
    var empty = $('#notes-empty');
    if (!grid) return;

    grid.innerHTML = '';

    if (notesList.length === 0) {
      if (empty) empty.classList.add('show');
    } else {
      if (empty) empty.classList.remove('show');
      notesList.forEach(function(note) {
        var card = document.createElement('div');
        card.className = 'note-card';
        card.setAttribute('data-note-id', note.id);

        var d = new Date(parseInt(note.id.replace('note-', ''), 10));
        var dateStr = d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

        card.innerHTML =
          '<div class="note-card-title">' + (note.title || '未命名便签') + '</div>' +
          '<div class="note-card-preview">' + (note.preview || '') + '</div>' +
          '<div class="note-card-date">' + dateStr + '</div>';

        card.addEventListener('click', function() { openNote(note.id); });
        grid.appendChild(card);
      });
    }

    /* 重新加入「新建」虚线卡片 */
    var addCard = document.createElement('div');
    addCard.className = 'note-card note-card--add';
    addCard.id = 'note-add-btn';
    addCard.innerHTML = '<div class="note-card-add-icon">＋</div><div>新建便签</div>';
    addCard.addEventListener('click', function(e) { e.stopPropagation(); createNote(); });
    grid.appendChild(addCard);
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

  /* 打开便签（调用 Vercel API 读取内容）*/
  function openNote(noteId) {
    currentNoteId = noteId;
    showNoteEdit();
    var titleInput = $('#note-title-input');
    var contentInput = $('#note-content-input');
    var dateEl = $('#note-edit-date');
    if (titleInput) titleInput.value = '加载中…';
    if (contentInput) contentInput.value = '加载中…';

    var ts = noteId.replace('note-', '');
    var d = new Date(parseInt(ts, 10));
    if (dateEl) dateEl.textContent = '创建于 ' + d.toLocaleString('zh-CN', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });

    fetch(API_BASE + '/' + noteId)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (titleInput) titleInput.value = data.title || '';
        if (contentInput) contentInput.value = data.content || '';
      })
      .catch(function() {
        if (titleInput) titleInput.value = '';
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

  /* 保存便签（调用 Vercel API，无需 Token）*/
  function saveNote() {
    var titleInput = $('#note-title-input');
    var contentInput = $('#note-content-input');
    if (!contentInput) return;
    var title = titleInput ? titleInput.value.trim() : '';
    var content = contentInput.value;
    var saveBtn = $('#note-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '保存中…'; }

    var fileName = (currentNoteId || ('note-' + Date.now())) + '.md';
    var fileContent = '# ' + title + '\n\n' + content;

    var payload = { filename: fileName, content: fileContent };
    if (currentNoteId) payload.sha = getCurrentNoteSha(currentNoteId);

    fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '保存'; }
        if (data.ok) {
          alert('保存成功！');
          if (!currentNoteId) currentNoteId = fileName.replace(/\.md$/, '');
          loadNotes();
        } else throw new Error(data.error || '保存失败');
      })
      .catch(function(err) {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '保存'; }
        alert('保存失败：' + (err.message || '请重试'));
      });
  }

  /* 获取当前便签的 sha（用于更新）*/
  function getCurrentNoteSha(noteId) {
    var note = notesList.filter(function(n) { return n.id === noteId; })[0];
    return note ? note.sha : null;
  }

  /* 删除便签（调用 Vercel API，无需 Token）*/
  function deleteNote() {
    if (!currentNoteId) return;
    if (!confirm('确定要删除这个便签吗？删除后无法恢复。')) return;

    var fileName = currentNoteId + '.md';
    var sha = getCurrentNoteSha(currentNoteId);
    if (!sha) { alert('删除失败：找不到文件信息'); return; }

    fetch(API_BASE, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: fileName, sha: sha })
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.ok) {
          alert('删除成功！');
          currentNoteId = null;
          loadNotes();
        } else throw new Error(data.error || '删除失败');
      })
      .catch(function(err) { alert('删除失败：' + (err.message || '请重试')); });
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
          '<span class="contact-card-icon wechat-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.434-.982.97-.982zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.952-7.062-6.122zm-2.18 2.769c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z"/></svg></span>' +
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

    var hash = (location.hash || '').replace('#', '') || 'home';
    showPage(ALL_PAGES.indexOf(hash) !== -1 ? hash : 'home');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
