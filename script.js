/* ==========================================================================
   اختبارات السفير — School Testing Application
   Vanilla JavaScript — all logic in modular functions
   --------------------------------------------------------------------------
   STRUCTURE:
     1.  Constants & state
     2.  DOM references
     3.  LocalStorage data layer (save/load exams, results, PIN)
     4.  Screen navigation helpers
     5.  Modal helpers (open/close/confirm)
     6.  Landing page + role selection
     7.  Teacher: PIN auth
     8.  Teacher: Dashboard (exams list, results table)
     9.  Teacher: Exam builder (create/edit, add questions, save)
     10. Student: Portal (name entry, exam list)
     11. Exam engine (timer, render questions, navigation, submit)
     12. Auto-grading & result screen
     13. Utility functions
     14. Event bindings & init
   ========================================================================== */

'use strict';

/* ==========================================================================
   1. CONSTANTS & STATE
   ========================================================================== */

const LS_KEYS = {
  EXAMS:   'safir_exams',
  RESULTS: 'safir_results',
  PIN:     'safir_pin',
};

const TEACHER_DEFAULT_PIN = '1234'; // shown as hint on first visit

const state = {
  currentScreen:   'landingPage',
  currentRole:     null,       // 'student' | 'teacher'
  editingExamId:   null,       // null = creating, number = editing
  activeExam:      null,       // exam object being taken
  activeStudent:   '',         // student name
  questionIndex:   0,          // current question in exam
  studentAnswers:  [],         // array of selected option indices
  examStartTime:   null,       // timestamp
  timerInterval:   null,       // interval ID
  timeRemaining:   0,          // seconds
  confirmCallback: null,       // pending confirm action
};

/* ==========================================================================
   2. DOM REFERENCES
   ========================================================================== */

const $ = (id) => document.getElementById(id);

const dom = {
  // Screens
  landing:          $('landingPage'),
  teacherDash:      $('teacherDashboard'),
  studentPortal:    $('studentPortal'),
  examScreen:       $('examScreen'),
  resultScreen:     $('resultScreen'),

  // Landing
  enterBtn:         $('enterBtn'),

  // Role modal
  roleModal:        $('roleModal'),

  // PIN modal
  pinModal:         $('pinModal'),
  pinForm:          $('pinForm'),
  pinInput:         $('pinInput'),
  pinError:         $('pinError'),
  pinSetupHint:     $('pinSetupHint'),

  // Teacher dashboard
  teacherLogout:    $('teacherLogoutBtn'),
  teacherExamsList: $('teacherExamsList'),
  teacherExamsEmpty:$('teacherExamsEmpty'),
  resultsTableWrap: $('resultsTableWrap'),
  resultsEmpty:     $('resultsEmpty'),
  createExamBtn:    $('createExamBtn'),

  // Exam builder modal
  examBuilderModal: $('examBuilderModal'),
  examBuilderTitle: $('examBuilderTitle'),
  examForm:         $('examForm'),
  examTitle:        $('examTitle'),
  examSubject:      $('examSubject'),
  examDuration:     $('examDuration'),
  examPassGrade:    $('examPassGrade'),
  examShowReview:   $('examShowReview'),
  examPdfUrl:       $('examPdfUrl'),
  questionsContainer:$('questionsContainer'),
  questionsEmpty:   $('questionsEmpty'),
  addQuestionBtn:   $('addQuestionBtn'),
  examFormError:    $('examFormError'),
  saveExamBtn:      $('saveExamBtn'),

  // Exam results modal (teacher)
  examResultsModal: $('examResultsModal'),
  examResultsTitle: $('examResultsTitle'),
  examResultsBody:  $('examResultsBody'),

  // Student portal
  studentLogout:    $('studentLogoutBtn'),
  studentName:      $('studentName'),
  studentExamsList: $('studentExamsList'),
  studentExamsEmpty:$('studentExamsEmpty'),

  // Exam screen
  examScreenTitle:  $('examScreenTitle'),
  examScreenStudent:$('examScreenStudent'),
  timerValue:       $('timerValue'),
  examTimer:        $('examTimer'),
  examProgressBar:  $('examProgressBar'),
  examPdfPanel:     $('examPdfPanel'),
  examPdfFrame:     $('examPdfFrame'),
  examQuestionArea: $('examQuestionArea'),
  questionDots:     $('questionDots'),
  prevQuestionBtn:  $('prevQuestionBtn'),
  nextQuestionBtn:  $('nextQuestionBtn'),
  submitExamBtn:    $('submitExamBtn'),

  // Result screen
  resultCard:       $('resultCard'),
  resultBackBtn:    $('resultBackBtn'),

  // Confirm modal
  confirmModal:     $('confirmModal'),
  confirmTitle:     $('confirmTitle'),
  confirmText:      $('confirmText'),
  confirmOkBtn:     $('confirmOkBtn'),
  confirmCancelBtn: $('confirmCancelBtn'),
};

/* ==========================================================================
   3. LOCALSTORAGE DATA LAYER
   ========================================================================== */

/** Safely parse JSON from localStorage. Returns fallback on error. */
function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

/** Safely write JSON to localStorage. */
function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('LocalStorage write failed:', e);
  }
}

/** Load all exams. */
function loadExams() {
  return lsGet(LS_KEYS.EXAMS, []);
}

/** Save all exams. */
function saveExams(exams) {
  lsSet(LS_KEYS.EXAMS, exams);
}

/** Load all results. */
function loadResults() {
  return lsGet(LS_KEYS.RESULTS, []);
}

/** Save all results. */
function saveResults(results) {
  lsSet(LS_KEYS.RESULTS, results);
}

/** Load teacher PIN. */
function loadPin() {
  return lsGet(LS_KEYS.PIN, null);
}

/** Save teacher PIN. */
function savePin(pin) {
  lsSet(LS_KEYS.PIN, pin);
}

/** Generate a unique ID for exams. */
function generateId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

/* ==========================================================================
   4. SCREEN NAVIGATION
   ========================================================================== */

/** Show a screen by element id, hide all others. */
function showScreen(screenId) {
  const screens = [dom.landing, dom.teacherDash, dom.studentPortal, dom.examScreen, dom.resultScreen];
  screens.forEach(function (s) {
    s.classList.remove('screen--active');
  });
  const target = $(screenId);
  if (target) {
    target.classList.add('screen--active');
    state.currentScreen = screenId;
    window.scrollTo(0, 0);
  }
}

/* ==========================================================================
   5. MODAL HELPERS
   ========================================================================== */

/** Open a modal overlay by id. */
function openModal(modalEl) {
  modalEl.hidden = false;
}

/** Close a modal overlay by id. */
function closeModal(modalEl) {
  modalEl.hidden = true;
}

/** Show confirm dialog with a title, message, and callback on confirm. */
function showConfirm(title, message, onConfirm) {
  dom.confirmTitle.textContent = title;
  dom.confirmText.textContent = message;
  state.confirmCallback = onConfirm;
  openModal(dom.confirmModal);
}

/* ==========================================================================
   6. LANDING PAGE + ROLE SELECTION
   ========================================================================== */

/** Handle the main enter button click — show role selection modal. */
function handleEnterClick() {
  openModal(dom.roleModal);
}

/** Handle role selection — navigate to student or teacher flow. */
function handleRoleSelect(role) {
  closeModal(dom.roleModal);
  state.currentRole = role;

  if (role === 'teacher') {
    handleTeacherEntry();
  } else if (role === 'student') {
    showScreen('studentPortal');
    renderStudentExams();
  }
}

/* ==========================================================================
   7. TEACHER: PIN AUTH
   ========================================================================== */

/** Teacher entry — show PIN modal, set up hint if first time. */
function handleTeacherEntry() {
  const existingPin = loadPin();

  if (existingPin === null) {
    dom.pinSetupHint.hidden = false;
    dom.pinModal.querySelector('.modal-box__subtitle').textContent = 'أدخل رمزاً سرياً جديداً لتأمين لوحة التحكم';
  } else {
    dom.pinSetupHint.hidden = true;
    dom.pinModal.querySelector('.modal-box__subtitle').textContent = 'أدخل الرمز السري للمتابعة';
  }

  dom.pinError.hidden = true;
  dom.pinInput.value = '';
  openModal(dom.pinModal);
  setTimeout(function () { dom.pinInput.focus(); }, 100);
}

/** Handle PIN form submission. */
function handlePinSubmit(e) {
  e.preventDefault();
  const enteredPin = dom.pinInput.value.trim();
  const existingPin = loadPin();
  dom.pinError.hidden = true;

  if (!enteredPin) {
    showPinError('الرجاء إدخال الرمز السري.');
    return;
  }

  if (existingPin === null) {
    // First-time setup
    savePin(enteredPin);
    closeModal(dom.pinModal);
    showScreen('teacherDashboard');
    renderTeacherExams();
    renderResultsTable();
  } else if (enteredPin === existingPin) {
    // Correct PIN
    closeModal(dom.pinModal);
    showScreen('teacherDashboard');
    renderTeacherExams();
    renderResultsTable();
  } else {
    showPinError('الرمز السري غير صحيح. حاول مرة أخرى.');
  }
}

/** Show PIN error message. */
function showPinError(msg) {
  dom.pinError.textContent = msg;
  dom.pinError.hidden = false;
}

/** Teacher logout — return to landing. */
function handleTeacherLogout() {
  state.currentRole = null;
  showScreen('landingPage');
}

/* ==========================================================================
   8. TEACHER: DASHBOARD
   ========================================================================== */

/** Switch dashboard tabs. */
function handleDashTab(tabName) {
  document.querySelectorAll('.dash-tab').forEach(function (tab) {
    tab.classList.toggle('dash-tab--active', tab.dataset.dashTab === tabName);
  });
  document.querySelectorAll('.dash-panel').forEach(function (panel) {
    panel.classList.remove('dash-panel--active');
  });
  if (tabName === 'exams') {
    $('dashPanelExams').classList.add('dash-panel--active');
  } else if (tabName === 'results') {
    $('dashPanelResults').classList.add('dash-panel--active');
  }
}

/** Render teacher exam cards. */
function renderTeacherExams() {
  const exams = loadExams();

  if (exams.length === 0) {
    dom.teacherExamsList.innerHTML = '';
    dom.teacherExamsEmpty.hidden = false;
    return;
  }

  dom.teacherExamsEmpty.hidden = true;

  dom.teacherExamsList.innerHTML = exams.map(function (exam) {
    const totalPoints = exam.questions.reduce(function (sum, q) { return sum + (q.points || 1); }, 0);
    const resultCount = loadResults().filter(function (r) { return r.examId === exam.id; }).length;

    return `
      <div class="exam-card" data-exam-id="${exam.id}">
        <div class="exam-card__head">
          <div>
            <h3 class="exam-card__title">${escapeHtml(exam.title)}</h3>
            <span class="exam-card__subject">${escapeHtml(exam.subject)}</span>
          </div>
          ${exam.pdfUrl ? '<span class="badge-pdf">PDF مرفق</span>' : ''}
        </div>
        <div class="exam-card__meta">
          <span class="meta-chip">&#9201; ${exam.duration} دقيقة</span>
          <span class="meta-chip">&#128221; ${exam.questions.length} سؤال</span>
          <span class="meta-chip">&#127919; نجاح ${exam.passGrade}%</span>
          <span class="meta-chip">&#128202; ${totalPoints} درجة</span>
          <span class="meta-chip">&#128100; ${resultCount} طالب</span>
        </div>
        <div class="exam-card__actions">
          <button class="btn btn--secondary btn--sm" data-action="edit-exam" data-exam-id="${exam.id}">تعديل</button>
          <button class="btn btn--secondary btn--sm" data-action="view-results" data-exam-id="${exam.id}">النتائج</button>
          <button class="btn btn--danger btn--sm" data-action="delete-exam" data-exam-id="${exam.id}">حذف</button>
        </div>
      </div>
    `;
  }).join('');
}

/** Render the full results table across all exams. */
function renderResultsTable() {
  const results = loadResults();

  if (results.length === 0) {
    dom.resultsTableWrap.innerHTML = '';
    dom.resultsEmpty.hidden = false;
    return;
  }

  dom.resultsEmpty.hidden = true;

  // Sort by date descending
  const sorted = results.slice().sort(function (a, b) {
    return new Date(b.date) - new Date(a.date);
  });

  dom.resultsTableWrap.innerHTML = `
    <table class="results-table">
      <thead>
        <tr>
          <th>الطالب</th>
          <th>الاختبار</th>
          <th>الدرجة</th>
          <th>النسبة</th>
          <th>الحالة</th>
          <th>الزمن</th>
          <th>التاريخ</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(function (r) {
          const statusClass = r.passed ? 'status-badge--pass' : 'status-badge--fail';
          const statusText = r.passed ? 'ناجح' : 'راسب';
          return `
            <tr>
              <td>${escapeHtml(r.studentName)}</td>
              <td>${escapeHtml(r.examTitle)}</td>
              <td>${r.score} / ${r.totalPoints}</td>
              <td>${r.percentage}%</td>
              <td><span class="status-badge ${statusClass}">${statusText}</span></td>
              <td>${formatTime(r.timeSpent)}</td>
              <td>${formatDate(r.date)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

/** Render results for a specific exam inside the modal. */
function renderExamResultsModal(examId) {
  const exam = loadExams().find(function (e) { return e.id === examId; });
  if (!exam) return;

  const results = loadResults().filter(function (r) { return r.examId === examId; });

  dom.examResultsTitle.textContent = 'نتائج: ' + exam.title;

  if (results.length === 0) {
    dom.examResultsBody.innerHTML = '<div class="empty-state empty-state--compact"><p>لا توجد نتائج لهذا الاختبار بعد.</p></div>';
  } else {
    const sorted = results.sort(function (a, b) { return b.percentage - a.percentage; });
    dom.examResultsBody.innerHTML = `
      <div class="results-table-wrap">
        <table class="results-table">
          <thead>
            <tr>
              <th>الطالب</th>
              <th>الدرجة</th>
              <th>النسبة</th>
              <th>الحالة</th>
              <th>الزمن</th>
              <th>التاريخ</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(function (r) {
              const statusClass = r.passed ? 'status-badge--pass' : 'status-badge--fail';
              const statusText = r.passed ? 'ناجح' : 'راسب';
              return `
                <tr>
                  <td>${escapeHtml(r.studentName)}</td>
                  <td>${r.score} / ${r.totalPoints}</td>
                  <td>${r.percentage}%</td>
                  <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                  <td>${formatTime(r.timeSpent)}</td>
                  <td>${formatDate(r.date)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  openModal(dom.examResultsModal);
}

/** Handle teacher exam card action (edit, results, delete). */
function handleExamCardAction(action, examId) {
  if (action === 'edit-exam') {
    openExamBuilder(examId);
  } else if (action === 'view-results') {
    renderExamResultsModal(examId);
  } else if (action === 'delete-exam') {
    const exam = loadExams().find(function (e) { return e.id === examId; });
    if (!exam) return;
    showConfirm(
      'حذف الاختبار',
      'هل أنت متأكد من حذف "' + exam.title + '"؟ سيتم حذف جميع النتائج المرتبطة به.',
      function () {
        deleteExam(examId);
      }
    );
  }
}

/** Delete an exam and its results. */
function deleteExam(examId) {
  const exams = loadExams().filter(function (e) { return e.id !== examId; });
  saveExams(exams);
  const results = loadResults().filter(function (r) { return r.examId !== examId; });
  saveResults(results);
  renderTeacherExams();
  renderResultsTable();
}

/* ==========================================================================
   9. TEACHER: EXAM BUILDER
   ========================================================================== */

/** Open the exam builder modal — either create new or edit existing. */
function openExamBuilder(examId) {
  state.editingExamId = examId || null;

  // Reset form
  dom.examForm.reset();
  dom.questionsContainer.innerHTML = '';
  dom.examFormError.hidden = true;

  if (examId) {
    // Editing existing exam
    const exam = loadExams().find(function (e) { return e.id === examId; });
    if (!exam) return;

    dom.examBuilderTitle.textContent = 'تعديل الاختبار';
    dom.examTitle.value = exam.title;
    dom.examSubject.value = exam.subject;
    dom.examDuration.value = exam.duration;
    dom.examPassGrade.value = exam.passGrade;
    dom.examShowReview.value = String(exam.showReview);
    dom.examPdfUrl.value = exam.pdfUrl || '';

    exam.questions.forEach(function (q) {
      addQuestionBlock(q);
    });
  } else {
    // Creating new — start with one empty question
    dom.examBuilderTitle.textContent = 'إنشاء اختبار جديد';
    dom.examDuration.value = 30;
    dom.examPassGrade.value = 50;
    addQuestionBlock();
  }

  updateQuestionsEmpty();
  openModal(dom.examBuilderModal);
}

/** Add a question block to the builder. If data is passed, populate it. */
function addQuestionBlock(data) {
  const container = dom.questionsContainer;
  const block = document.createElement('div');
  block.className = 'question-block';

  const questionNum = container.children.length + 1;

  block.innerHTML = `
    <div class="question-block__head">
      <span class="question-block__num">سؤال ${questionNum}</span>
      <button type="button" class="question-block__remove" data-action="remove-question">حذف السؤال</button>
    </div>
    <div class="form-field">
      <input type="text" class="qb-text" placeholder="نص السؤال" required />
    </div>
    <div class="qb-options">
      ${[0, 1, 2, 3].map(function (i) {
        return `
          <div class="qb-option-row">
            <input type="radio" name="correct_${questionNum}" value="${i}" title="الإجابة الصحيحة" />
            <input type="text" class="qb-option" placeholder="الخيار ${i + 1}" required />
          </div>
        `;
      }).join('')}
    </div>
    <div class="qb-points">
      <label>الدرجة:</label>
      <input type="number" class="qb-point-value" value="1" min="1" max="100" />
    </div>
  `;

  container.appendChild(block);

  // Populate if editing
  if (data) {
    block.querySelector('.qb-text').value = data.text || '';
    const optionInputs = block.querySelectorAll('.qb-option');
    data.options.forEach(function (opt, i) {
      if (optionInputs[i]) optionInputs[i].value = opt;
    });
    const correctRadio = block.querySelector('input[name="correct_' + questionNum + '"][value="' + data.correctIndex + '"]');
    if (correctRadio) correctRadio.checked = true;
    block.querySelector('.qb-point-value').value = data.points || 1;
  }

  updateQuestionsEmpty();

  // Re-number all questions
  renumberQuestions();
}

/** Remove a question block. */
function removeQuestionBlock(blockEl) {
  blockEl.remove();
  renumberQuestions();
  updateQuestionsEmpty();
}

/** Re-number all question blocks after add/remove. */
function renumberQuestions() {
  const blocks = dom.questionsContainer.querySelectorAll('.question-block');
  blocks.forEach(function (block, idx) {
    const numEl = block.querySelector('.question-block__num');
    if (numEl) numEl.textContent = 'سؤال ' + (idx + 1);

    // Update radio name to match new index
    const radios = block.querySelectorAll('input[type="radio"]');
    const newName = 'correct_' + (idx + 1);
    radios.forEach(function (r) {
      r.name = newName;
    });
  });
}

/** Show/hide the "add at least one question" empty state. */
function updateQuestionsEmpty() {
  const count = dom.questionsContainer.children.length;
  dom.questionsEmpty.hidden = count > 0;
}

/** Collect question data from the builder. Returns array or null on error. */
function collectQuestions() {
  const blocks = dom.questionsContainer.querySelectorAll('.question-block');
  const questions = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const text = block.querySelector('.qb-text').value.trim();
    if (!text) {
      return { error: 'السؤال ' + (i + 1) + ': نص السؤال مطلوب.' };
    }

    const optionInputs = block.querySelectorAll('.qb-option');
    const options = [];
    for (let j = 0; j < optionInputs.length; j++) {
      const optVal = optionInputs[j].value.trim();
      if (!optVal) {
        return { error: 'السؤال ' + (i + 1) + ': الخيار ' + (j + 1) + ' مطلوب.' };
      }
      options.push(optVal);
    }

    const correctRadio = block.querySelector('input[type="radio"]:checked');
    if (!correctRadio) {
      return { error: 'السؤال ' + (i + 1) + ': حدد الإجابة الصحيحة.' };
    }

    const points = parseInt(block.querySelector('.qb-point-value').value, 10) || 1;

    questions.push({
      text: text,
      options: options,
      correctIndex: parseInt(correctRadio.value, 10),
      points: points,
    });
  }

  if (questions.length === 0) {
    return { error: 'أضف سؤالاً واحداً على الأقل.' };
  }

  return { questions: questions };
}

/** Handle exam form submission — validate and save. */
function handleExamFormSubmit(e) {
  e.preventDefault();
  dom.examFormError.hidden = true;

  const title = dom.examTitle.value.trim();
  const subject = dom.examSubject.value.trim();
  const duration = parseInt(dom.examDuration.value, 10);
  const passGrade = parseInt(dom.examPassGrade.value, 10);
  const showReview = dom.examShowReview.value === 'true';
  const pdfUrl = dom.examPdfUrl.value.trim();

  if (!title || !subject) {
    showExamFormError('العنوان والمادة مطلوبان.');
    return;
  }

  if (!duration || duration < 1) {
    showExamFormError('المدة يجب أن تكون دقيقة واحدة على الأقل.');
    return;
  }

  const result = collectQuestions();
  if (result.error) {
    showExamFormError(result.error);
    return;
  }

  const examData = {
    id: state.editingExamId || generateId(),
    title: title,
    subject: subject,
    duration: duration,
    passGrade: passGrade,
    showReview: showReview,
    pdfUrl: pdfUrl || null,
    questions: result.questions,
    createdAt: state.editingExamId
      ? (loadExams().find(function (e) { return e.id === state.editingExamId; }) || {}).createdAt || new Date().toISOString()
      : new Date().toISOString(),
  };

  const exams = loadExams();

  if (state.editingExamId) {
    // Update existing
    const idx = exams.findIndex(function (e) { return e.id === state.editingExamId; });
    if (idx !== -1) {
      exams[idx] = examData;
    }
  } else {
    // Add new
    exams.push(examData);
  }

  saveExams(exams);
  closeModal(dom.examBuilderModal);
  state.editingExamId = null;
  renderTeacherExams();
}

/** Show exam form error. */
function showExamFormError(msg) {
  dom.examFormError.textContent = msg;
  dom.examFormError.hidden = false;
}

/* ==========================================================================
   10. STUDENT: PORTAL
   ========================================================================== */

/** Render available exams for the student. */
function renderStudentExams() {
  const exams = loadExams();

  if (exams.length === 0) {
    dom.studentExamsList.innerHTML = '';
    dom.studentExamsEmpty.hidden = false;
    return;
  }

  dom.studentExamsEmpty.hidden = true;

  dom.studentExamsList.innerHTML = exams.map(function (exam) {
    const totalPoints = exam.questions.reduce(function (sum, q) { return sum + (q.points || 1); }, 0);
    return `
      <div class="exam-card" data-exam-id="${exam.id}">
        <div class="exam-card__head">
          <div>
            <h3 class="exam-card__title">${escapeHtml(exam.title)}</h3>
            <span class="exam-card__subject">${escapeHtml(exam.subject)}</span>
          </div>
          ${exam.pdfUrl ? '<span class="badge-pdf">PDF مرفق</span>' : ''}
        </div>
        <div class="exam-card__meta">
          <span class="meta-chip">&#9201; ${exam.duration} دقيقة</span>
          <span class="meta-chip">&#128221; ${exam.questions.length} سؤال</span>
          <span class="meta-chip">&#127919; نجاح ${exam.passGrade}%</span>
          <span class="meta-chip">&#128202; ${totalPoints} درجة</span>
        </div>
        <div class="exam-card__actions">
          <button class="btn btn--primary" data-action="start-exam" data-exam-id="${exam.id}">
            ابدأ الاختبار
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/** Student logout — return to landing. */
function handleStudentLogout() {
  state.currentRole = null;
  state.activeStudent = '';
  dom.studentName.value = '';
  showScreen('landingPage');
}

/** Handle student clicking "start exam" on a card. */
function handleStartExam(examId) {
  const name = dom.studentName.value.trim();
  if (!name) {
    dom.studentName.focus();
    dom.studentName.style.borderColor = 'var(--c-danger)';
    setTimeout(function () { dom.studentName.style.borderColor = ''; }, 2000);
    return;
  }

  const exam = loadExams().find(function (e) { return e.id === examId; });
  if (!exam) return;

  state.activeStudent = name;
  startExam(exam);
}

/* ==========================================================================
   11. EXAM ENGINE
   ========================================================================== */

/** Start the exam — set up state, render first question, start timer. */
function startExam(exam) {
  state.activeExam = exam;
  state.questionIndex = 0;
  state.studentAnswers = new Array(exam.questions.length).fill(null);
  state.examStartTime = Date.now();
  state.timeRemaining = exam.duration * 60;

  // Set up screen
  dom.examScreenTitle.textContent = exam.title;
  dom.examScreenStudent.textContent = 'الطالب: ' + state.activeStudent;

  // PDF panel
  if (exam.pdfUrl) {
    dom.examPdfFrame.src = exam.pdfUrl;
    dom.examPdfPanel.hidden = false;
    document.querySelector('.exam-body').classList.add('exam-body--with-pdf');
  } else {
    dom.examPdfFrame.src = '';
    dom.examPdfPanel.hidden = true;
    document.querySelector('.exam-body').classList.remove('exam-body--with-pdf');
  }

  // Render
  renderQuestion();
  renderQuestionDots();
  updateProgressBar();

  // Start timer
  startTimer();

  // Show screen
  showScreen('examScreen');
}

/** Render the current question. */
function renderQuestion() {
  const exam = state.activeExam;
  if (!exam) return;
  const q = exam.questions[state.questionIndex];
  if (!q) return;

  const answered = state.studentAnswers[state.questionIndex];

  dom.examQuestionArea.innerHTML = `
    <div class="exam-question">
      <p class="exam-question__num">السؤال ${state.questionIndex + 1} من ${exam.questions.length}</p>
      <p class="exam-question__text">${escapeHtml(q.text)}</p>
      <div class="exam-options">
        ${q.options.map(function (opt, i) {
          const selected = answered === i ? 'exam-option--selected' : '';
          return `
            <label class="exam-option ${selected}" data-option-index="${i}">
              <input type="radio" name="exam_q" value="${i}" ${answered === i ? 'checked' : ''} />
              <span class="exam-option__text">${escapeHtml(opt)}</span>
            </label>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Attach option click handlers
  dom.examQuestionArea.querySelectorAll('.exam-option').forEach(function (label) {
    label.addEventListener('click', function () {
      const optIdx = parseInt(label.dataset.optionIndex, 10);
      state.studentAnswers[state.questionIndex] = optIdx;
      // Update visual state
      dom.examQuestionArea.querySelectorAll('.exam-option').forEach(function (l) {
        l.classList.remove('exam-option--selected');
      });
      label.classList.add('exam-option--selected');
      label.querySelector('input[type="radio"]').checked = true;
      renderQuestionDots();
    });
  });

  // Navigation button states
  dom.prevQuestionBtn.disabled = state.questionIndex === 0;
  dom.nextQuestionBtn.disabled = state.questionIndex === exam.questions.length - 1;
}

/** Render question navigation dots. */
function renderQuestionDots() {
  const exam = state.activeExam;
  if (!exam) return;

  dom.questionDots.innerHTML = exam.questions.map(function (q, i) {
    const isCurrent = i === state.questionIndex;
    const isAnswered = state.studentAnswers[i] !== null;
    let cls = 'nav-dot';
    if (isCurrent) cls += ' nav-dot--current';
    else if (isAnswered) cls += ' nav-dot--answered';
    return `<button type="button" class="${cls}" data-q-index="${i}">${i + 1}</button>`;
  }).join('');

  dom.questionDots.querySelectorAll('.nav-dot').forEach(function (dot) {
    dot.addEventListener('click', function () {
      state.questionIndex = parseInt(dot.dataset.qIndex, 10);
      renderQuestion();
      renderQuestionDots();
      updateProgressBar();
    });
  });
}

/** Update the progress bar. */
function updateProgressBar() {
  const exam = state.activeExam;
  if (!exam) return;
  const answered = state.studentAnswers.filter(function (a) { return a !== null; }).length;
  const pct = (answered / exam.questions.length) * 100;
  dom.examProgressBar.style.width = pct + '%';
}

/** Start the countdown timer. */
function startTimer() {
  stopTimer();
  updateTimerDisplay();

  state.timerInterval = setInterval(function () {
    state.timeRemaining--;
    updateTimerDisplay();

    if (state.timeRemaining <= 0) {
      stopTimer();
      // Auto-submit when time expires
      submitExam(true);
    }
  }, 1000);
}

/** Stop the timer interval. */
function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

/** Update the timer display and warning states. */
function updateTimerDisplay() {
  const mins = Math.floor(state.timeRemaining / 60);
  const secs = state.timeRemaining % 60;
  dom.timerValue.textContent =
    String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

  // Warning states
  dom.examTimer.classList.remove('exam-timer--warning', 'exam-timer--danger');
  if (state.timeRemaining <= 30) {
    dom.examTimer.classList.add('exam-timer--danger');
  } else if (state.timeRemaining <= 60) {
    dom.examTimer.classList.add('exam-timer--warning');
  }
}

/** Navigate to next question. */
function handleNextQuestion() {
  const exam = state.activeExam;
  if (!exam) return;
  if (state.questionIndex < exam.questions.length - 1) {
    state.questionIndex++;
    renderQuestion();
    renderQuestionDots();
    updateProgressBar();
  }
}

/** Navigate to previous question. */
function handlePrevQuestion() {
  if (state.questionIndex > 0) {
    state.questionIndex--;
    renderQuestion();
    renderQuestionDots();
    updateProgressBar();
  }
}

/** Handle manual exam submission. */
function handleSubmitExamClick() {
  const answered = state.studentAnswers.filter(function (a) { return a !== null; }).length;
  const total = state.activeExam ? state.activeExam.questions.length : 0;
  const unanswered = total - answered;

  if (unanswered > 0) {
    showConfirm(
      'تأكيد التسليم',
      'لديك ' + unanswered + ' سؤال بدون إجابة. هل تريد التسليم فعلاً؟',
      function () { submitExam(false); }
    );
  } else {
    showConfirm(
      'تأكيد التسليم',
      'هل أنت متأكد من تسليم الاختبار؟',
      function () { submitExam(false); }
    );
  }
}

/* ==========================================================================
   12. AUTO-GRADING & RESULT SCREEN
   ========================================================================== */

/** Grade the exam, save result, and show the result screen. */
function submitExam(isAutoSubmit) {
  stopTimer();

  const exam = state.activeExam;
  if (!exam) return;

  // Calculate score
  let earnedPoints = 0;
  let totalPoints = 0;

  exam.questions.forEach(function (q, i) {
    totalPoints += (q.points || 1);
    if (state.studentAnswers[i] === q.correctIndex) {
      earnedPoints += (q.points || 1);
    }
  });

  const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const passed = percentage >= exam.passGrade;
  const timeSpent = Math.round((Date.now() - state.examStartTime) / 1000);

  // Save result to localStorage
  const results = loadResults();
  const resultRecord = {
    id: generateId(),
    examId: exam.id,
    examTitle: exam.title,
    studentName: state.activeStudent,
    score: earnedPoints,
    totalPoints: totalPoints,
    percentage: percentage,
    passed: passed,
    timeSpent: timeSpent,
    date: new Date().toISOString(),
    answers: state.studentAnswers.slice(),
  };
  results.push(resultRecord);
  saveResults(results);

  // Render result screen
  renderResultScreen(exam, resultRecord, isAutoSubmit);

  // Clear exam state
  state.activeExam = null;
  state.questionIndex = 0;
  state.studentAnswers = [];
  state.examStartTime = null;
  state.timeRemaining = 0;
}

/** Render the result screen with score, status, and optional review. */
function renderResultScreen(exam, result, isAutoSubmit) {
  const passClass = result.passed ? 'result-card__status--pass' : 'result-card__status--fail';
  const passText = result.passed ? 'ناجح' : 'راسب';
  const icon = result.passed ? '&#127881;' : '&#128542;';
  const autoNote = isAutoSubmit
    ? '<p style="color: var(--c-warning); font-size:0.85rem; margin-bottom:0.5rem;">انتهى الوقت — تم التسليم تلقائياً.</p>'
    : '';

  let reviewHTML = '';

  if (exam.showReview) {
    reviewHTML = `
      <div class="result-review">
        <h3 class="result-review__title">مراجعة الإجابات</h3>
        ${exam.questions.map(function (q, i) {
          const studentAns = result.answers[i];
          const isCorrect = studentAns === q.correctIndex;
          const statusClass = isCorrect ? 'status-badge--pass' : 'status-badge--fail';
          const statusText = isCorrect ? 'صحيح' : 'خطأ';
          const studentText = studentAns !== null
            ? escapeHtml(q.options[studentAns])
            : 'لم يتم الإجابة';
          const correctText = escapeHtml(q.options[q.correctIndex]);

          return `
            <div class="review-item">
              <div class="review-item__head">
                <span class="review-item__num">سؤال ${i + 1}</span>
                <span class="status-badge ${statusClass}">${statusText}</span>
              </div>
              <p class="review-item__text">${escapeHtml(q.text)}</p>
              <div class="review-item__answer review-item__answer--correct">
                الإجابة الصحيحة: ${correctText}
              </div>
              ${!isCorrect ? `<div class="review-item__answer review-item__answer--wrong">إجابتك: ${studentText}</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  dom.resultCard.innerHTML = `
    <div class="result-card__icon">${icon}</div>
    ${autoNote}
    <div class="result-card__score">${result.score} <small>/ ${result.totalPoints}</small></div>
    <div class="result-card__status ${passClass}">${passText} — ${result.percentage}%</div>
    <div class="result-card__meta">
      <span>&#128100; ${escapeHtml(result.studentName)}</span>
      <span>&#128221; ${escapeHtml(exam.title)}</span>
      <span>&#9201; ${formatTime(result.timeSpent)}</span>
    </div>
    ${reviewHTML}
  `;

  showScreen('resultScreen');
}

/** Handle "back to exams" from result screen. */
function handleResultBack() {
  if (state.currentRole === 'teacher') {
    showScreen('teacherDashboard');
    renderTeacherExams();
    renderResultsTable();
  } else {
    showScreen('studentPortal');
    renderStudentExams();
  }
}

/* ==========================================================================
   13. UTILITY FUNCTIONS
   ========================================================================== */

/** Escape HTML to prevent XSS in user-generated content. */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Format seconds into MM:SS or human readable. */
function formatTime(seconds) {
  if (!seconds && seconds !== 0) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + 'د ' + s + 'ث';
}

/** Format ISO date to Arabic-friendly display. */
function formatDate(isoStr) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return isoStr;
  }
}

/* ==========================================================================
   14. EVENT BINDINGS & INIT
   ========================================================================== */

function init() {
  // --- Landing ---
  dom.enterBtn.addEventListener('click', handleEnterClick);

  // --- Role modal ---
  document.querySelectorAll('.role-card').forEach(function (card) {
    card.addEventListener('click', function () {
      handleRoleSelect(card.dataset.role);
    });
  });

  // --- Modal close buttons (generic) ---
  document.querySelectorAll('[data-close-modal]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const modalId = btn.dataset.closeModal;
      const modal = $(modalId);
      if (modal) closeModal(modal);
    });
  });

  // --- Close modal on overlay click ---
  document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        closeModal(overlay);
      }
    });
  });

  // --- Escape key closes any open modal ---
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
        if (!overlay.hidden) closeModal(overlay);
      });
    }
  });

  // --- PIN form ---
  dom.pinForm.addEventListener('submit', handlePinSubmit);

  // --- Teacher logout ---
  dom.teacherLogout.addEventListener('click', handleTeacherLogout);

  // --- Dashboard tabs ---
  document.querySelectorAll('.dash-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      handleDashTab(tab.dataset.dashTab);
    });
  });

  // --- Create exam button ---
  dom.createExamBtn.addEventListener('click', function () {
    openExamBuilder(null);
  });

  // --- Add question button ---
  dom.addQuestionBtn.addEventListener('click', function () {
    addQuestionBlock();
  });

  // --- Remove question (delegated) ---
  dom.questionsContainer.addEventListener('click', function (e) {
    if (e.target.dataset.action === 'remove-question') {
      const block = e.target.closest('.question-block');
      if (block) removeQuestionBlock(block);
    }
  });

  // --- Exam form submit ---
  dom.examForm.addEventListener('submit', handleExamFormSubmit);

  // --- Teacher exams list (delegated actions) ---
  dom.teacherExamsList.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const examId = parseInt(btn.dataset.examId, 10);
    handleExamCardAction(action, examId);
  });

  // --- Student logout ---
  dom.studentLogout.addEventListener('click', handleStudentLogout);

  // --- Student exams list (delegated) ---
  dom.studentExamsList.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'start-exam') {
      const examId = parseInt(btn.dataset.examId, 10);
      handleStartExam(examId);
    }
  });

  // --- Exam navigation ---
  dom.prevQuestionBtn.addEventListener('click', handlePrevQuestion);
  dom.nextQuestionBtn.addEventListener('click', handleNextQuestion);
  dom.submitExamBtn.addEventListener('click', handleSubmitExamClick);

  // --- Result back ---
  dom.resultBackBtn.addEventListener('click', handleResultBack);

  // --- Confirm modal ---
  dom.confirmOkBtn.addEventListener('click', function () {
    closeModal(dom.confirmModal);
    if (typeof state.confirmCallback === 'function') {
      state.confirmCallback();
      state.confirmCallback = null;
    }
  });

  dom.confirmCancelBtn.addEventListener('click', function () {
    closeModal(dom.confirmModal);
    state.confirmCallback = null;
  });
}

// Run init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
