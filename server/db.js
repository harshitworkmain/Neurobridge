import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'neurobridge.db');

const db = new Database(dbPath, { verbose: console.log });
db.pragma('journal_mode = WAL');

// Initialize Schema
function initDb() {
  // Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age_string TEXT,
      parent_email TEXT,
      password_hash TEXT
    )
  `);

  // Screenings Table — Extended for structured metrics
  db.exec(`
    CREATE TABLE IF NOT EXISTS screenings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      overall_score REAL,
      risk_level TEXT,
      vision_score REAL,
      vision_probability REAL,
      eeg_score REAL,
      attention_metric REAL,
      motor_metric REAL,
      notes TEXT,
      -- V2 structured metrics columns
      session_duration REAL,
      face_presence REAL,
      engagement REAL,
      fixation_avg REAL,
      quality_score REAL,
      quality_label TEXT,
      is_reliable INTEGER DEFAULT 1,
      fusion_mode TEXT DEFAULT 'vision_only',
      behavioral_score REAL,
      component_scores_json TEXT,
      temporal_features_json TEXT,
      explanations_json TEXT,
      triage_level TEXT,
      triage_color TEXT,
      heatmap_image TEXT,
      attention_series_json TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Behavioral Questionnaire Responses Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS questionnaire_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      screening_id INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      responses_json TEXT,
      behavior_score REAL,
      risk_level TEXT,
      domain_severity_json TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(screening_id) REFERENCES screenings(id)
    )
  `);

  // Consent Audit Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS consent_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      consent_type TEXT,
      consent_given INTEGER,
      ip_address TEXT,
      user_agent TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // ============================================
  // CLINICIAN INTELLIGENCE TABLES (Phase 9)
  // ============================================

  // Patient Analytics — longitudinal trend tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_analytics (
      user_id INTEGER PRIMARY KEY,
      total_sessions INTEGER DEFAULT 0,
      baseline_risk REAL DEFAULT 0,
      current_risk REAL DEFAULT 0,
      risk_trend_slope REAL DEFAULT 0,
      engagement_trend REAL DEFAULT 0,
      gaze_variance_trend REAL DEFAULT 0,
      improvement_rate REAL DEFAULT 0,
      regression_flag INTEGER DEFAULT 0,
      predicted_risk_30d REAL DEFAULT 0,
      stability_index REAL DEFAULT 0,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Therapy Outcomes — effectiveness tracking per module
  db.exec(`
    CREATE TABLE IF NOT EXISTS therapy_outcomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      therapy_module TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      risk_change REAL DEFAULT 0,
      engagement_change REAL DEFAULT 0,
      status TEXT DEFAULT 'no_change',
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Clinician Performance — aggregate clinician metrics
  db.exec(`
    CREATE TABLE IF NOT EXISTS clinician_performance (
      clinician_id INTEGER PRIMARY KEY,
      patients_handled INTEGER DEFAULT 0,
      avg_risk_reduction REAL DEFAULT 0,
      avg_engagement_improvement REAL DEFAULT 0,
      regression_rate REAL DEFAULT 0,
      therapy_success_rate REAL DEFAULT 0,
      effectiveness_score REAL DEFAULT 0,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ============================================
  // PRODUCT WORKFLOW TABLES (Phases 1, 2, 6)
  // ============================================

  // Phase 1: Therapy Completion — daily caregiver task tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS therapy_completion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      task_id TEXT NOT NULL,
      task_name TEXT,
      date TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      duration_minutes INTEGER DEFAULT 0,
      UNIQUE(user_id, task_id, date),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Phase 2: Alerts — clinician notification system
  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT NOT NULL,
      severity TEXT DEFAULT 'low',
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved INTEGER DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Phase 6: Reminders — engagement & retention tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      last_session_date TEXT,
      next_reminder_date TEXT,
      sent INTEGER DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // ============================================
  // TELECONSULTATION TABLES (New Module)
  // ============================================

  // Appointments: scheduling system
  db.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      clinician_id INTEGER NOT NULL,
      scheduled_at DATETIME NOT NULL,
      duration_minutes INTEGER DEFAULT 30,
      status TEXT DEFAULT 'scheduled',
      meeting_room_id TEXT,
      type TEXT DEFAULT 'consultation',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(patient_id) REFERENCES users(id),
      FOREIGN KEY(clinician_id) REFERENCES users(id)
    )
  `);

  // Session notes linked to patient timeline
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL,
      clinician_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      content TEXT,
      follow_up_actions TEXT,
      linked_screening_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(appointment_id) REFERENCES appointments(id),
      FOREIGN KEY(clinician_id) REFERENCES users(id),
      FOREIGN KEY(patient_id) REFERENCES users(id)
    )
  `);

  // ============================================
  // THERAPY GAMES TABLES (New Module)
  // ============================================

  // Game definitions (static config)
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      target_skill TEXT,
      description TEXT,
      min_age INTEGER DEFAULT 3,
      max_age INTEGER DEFAULT 12,
      max_level INTEGER DEFAULT 5,
      is_active INTEGER DEFAULT 1
    )
  `);

  // Per-user game progress
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id TEXT NOT NULL,
      current_level INTEGER DEFAULT 1,
      total_sessions INTEGER DEFAULT 0,
      best_accuracy REAL DEFAULT 0,
      avg_accuracy REAL DEFAULT 0,
      total_play_time_seconds INTEGER DEFAULT 0,
      last_played_at DATETIME,
      streak_days INTEGER DEFAULT 0,
      badges_json TEXT DEFAULT '[]',
      UNIQUE(user_id, game_id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(game_id) REFERENCES games(id)
    )
  `);

  // Individual game sessions (detailed logs)
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id TEXT NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      duration_seconds REAL,
      level INTEGER,
      accuracy_score REAL,
      completion_rate REAL,
      avg_response_time_ms REAL,
      error_count INTEGER DEFAULT 0,
      hint_usage INTEGER DEFAULT 0,
      engagement_score REAL,
      difficulty_adjustment TEXT DEFAULT 'hold',
      gaze_metrics_json TEXT,
      raw_events_json TEXT,
      caregiver_notes_json TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(game_id) REFERENCES games(id)
    )
  `);

  // Adaptive recommendations
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_id TEXT NOT NULL,
      reason TEXT,
      priority INTEGER DEFAULT 5,
      source TEXT DEFAULT 'system',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      dismissed INTEGER DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(game_id) REFERENCES games(id)
    )
  `);

  // ============================================
  // COMMUNITY PLATFORM TABLES (New Module)
  // ============================================

  // Topic categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS community_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    )
  `);

  // Posts
  db.exec(`
    CREATE TABLE IF NOT EXISTS community_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL,
      category_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_pinned INTEGER DEFAULT 0,
      is_verified INTEGER DEFAULT 0,
      verified_by INTEGER,
      like_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(author_id) REFERENCES users(id),
      FOREIGN KEY(category_id) REFERENCES community_categories(id)
    )
  `);

  // Comments (single-level threading)
  db.exec(`
    CREATE TABLE IF NOT EXISTS community_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      parent_comment_id INTEGER,
      content TEXT NOT NULL,
      like_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(post_id) REFERENCES community_posts(id),
      FOREIGN KEY(author_id) REFERENCES users(id)
    )
  `);

  // Likes (polymorphic)
  db.exec(`
    CREATE TABLE IF NOT EXISTS community_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, target_type, target_id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // Content reports / abuse flags
  db.exec(`
    CREATE TABLE IF NOT EXISTS community_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      reviewed_by INTEGER,
      reviewed_at DATETIME,
      action_taken TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(reporter_id) REFERENCES users(id)
    )
  `);

  // Community bookmarks
  db.exec(`
    CREATE TABLE IF NOT EXISTS community_bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(post_id) REFERENCES community_posts(id)
    )
  `);

  // ============================================
  // UNIFIED NOTIFICATION CENTER
  // ============================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      source_module TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      link TEXT,
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // ============================================
  // USER PREFERENCES
  // ============================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id INTEGER PRIMARY KEY,
      sensory_mode INTEGER DEFAULT 0,
      dark_mode INTEGER DEFAULT 0,
      onboarding_completed INTEGER DEFAULT 0,
      preferences_json TEXT DEFAULT '{}',
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // ============================================
  // THERAPY GOALS
  // ============================================

  db.exec(`
    CREATE TABLE IF NOT EXISTS therapy_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      created_by INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      domain TEXT DEFAULT 'general',
      target_metric TEXT,
      target_value REAL,
      current_value REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      priority TEXT DEFAULT 'medium',
      due_date TEXT,
      completed_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(created_by) REFERENCES users(id)
    )
  `);

  // ============================================
  // MIGRATIONS for existing databases
  // ============================================
  const migrations = [
    { column: 'vision_probability', type: 'REAL' },
    { column: 'session_duration', type: 'REAL' },
    { column: 'face_presence', type: 'REAL' },
    { column: 'engagement', type: 'REAL' },
    { column: 'fixation_avg', type: 'REAL' },
    { column: 'quality_score', type: 'REAL' },
    { column: 'quality_label', type: 'TEXT' },
    { column: 'is_reliable', type: 'INTEGER DEFAULT 1' },
    { column: 'fusion_mode', type: 'TEXT' },
    { column: 'behavioral_score', type: 'REAL' },
    { column: 'component_scores_json', type: 'TEXT' },
    { column: 'temporal_features_json', type: 'TEXT' },
    { column: 'explanations_json', type: 'TEXT' },
    { column: 'triage_level', type: 'TEXT' },
    { column: 'triage_color', type: 'TEXT' },
    { column: 'heatmap_image', type: 'TEXT' },
    { column: 'attention_series_json', type: 'TEXT' }
  ];

  // Migration for users table (Phase 8 + new role system)
  try {
    const userCols = db.prepare('PRAGMA table_info(users)').all();
    const existingUserCols = new Set(userCols.map(c => c.name));

    const userMigrations = [
      { column: 'password_hash', type: 'TEXT' },
      { column: 'role', type: "TEXT DEFAULT 'parent'" },
      { column: 'display_name', type: 'TEXT' },
      { column: 'account_status', type: "TEXT DEFAULT 'active'" }
    ];

    for (const { column, type } of userMigrations) {
      if (!existingUserCols.has(column)) {
        console.log(`Migrating DB: Adding ${column} to users...`);
        db.exec(`ALTER TABLE users ADD COLUMN ${column} ${type}`);
      }
    }
  } catch (e) {
    console.warn('User migration failed:', e.message);
  }

  try {
    const columns = db.prepare('PRAGMA table_info(screenings)').all();
    const existingCols = new Set(columns.map(c => c.name));

    for (const { column, type } of migrations) {
      if (!existingCols.has(column)) {
        console.log(`Migrating DB: Adding ${column}...`);
        db.exec(`ALTER TABLE screenings ADD COLUMN ${column} ${type}`);
      }
    }
  } catch (e) {
    console.warn('Migration check failed:', e.message);
  }

  // Seed default user if not exists
  const stmt = db.prepare('SELECT count(*) as count FROM users');
  const result = stmt.get();
  if (result.count === 0) {
    console.log('Seeding default user...');
    db.prepare('INSERT INTO users (name, age_string, parent_email, role) VALUES (?, ?, ?, ?)')
      .run('Alex', '3 years, 2 months', 'parent@example.com', 'parent');
  }

  // ============================================
  // SEED DATA — Games & Community Categories
  // ============================================
  seedGames();
  seedCommunityCategories();
  seedCommunityPosts();
}

function seedGames() {
  const gameCount = db.prepare('SELECT count(*) as count FROM games').get();
  if (gameCount.count > 0) return;

  console.log('Seeding therapy games...');
  const insert = db.prepare(`
    INSERT INTO games (id, name, category, target_skill, description, min_age, max_age, max_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const games = [
    ['gaze_garden', 'Gaze Garden', 'attention', 'Sustained attention & gaze fixation',
      'Flowers grow where you look! Keep your gaze steady on target zones to water the plants.', 3, 10, 5],
    ['emotion_mirror', 'Emotion Mirror', 'emotion', 'Facial expression identification',
      'Can you match the emotion? See a feeling, then show it on your face!', 4, 12, 5],
    ['day_builder', 'Day Builder', 'daily_living', 'ADL skills & sequencing',
      'Put the daily activities in the right order. Build your perfect day!', 3, 8, 5],
    ['memory_match', 'Memory Match', 'memory', 'Visual memory & pattern recognition',
      'Find the matching pairs! Flip cards and remember where each picture is.', 3, 12, 5]
  ];

  const insertMany = db.transaction(() => {
    for (const g of games) {
      insert.run(...g);
    }
  });
  insertMany();
}

function seedCommunityCategories() {
  const catCount = db.prepare('SELECT count(*) as count FROM community_categories').get();
  if (catCount.count > 0) return;

  console.log('Seeding community categories...');
  const insert = db.prepare(`
    INSERT INTO community_categories (id, name, description, icon, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  const categories = [
    ['parenting_tips', 'Parenting Tips', 'Share strategies that work for your family', '💡', 1],
    ['therapy_wins', 'Therapy Wins', 'Celebrate progress, big or small', '🎉', 2],
    ['daily_challenges', 'Daily Challenges', 'Discuss everyday hurdles and solutions', '💪', 3],
    ['sensory_tools', 'Sensory Tools', 'Recommendations for sensory-friendly products and environments', '🎧', 4],
    ['school_tips', 'School & Education', 'IEP advice, school accommodations, and learning support', '📚', 5],
    ['teen_life', 'Teen & Adult Life', 'Topics for older individuals on the spectrum', '🌟', 6],
    ['research_corner', 'Research Corner', 'Share and discuss latest ASD research', '🔬', 7],
    ['ask_clinician', 'Ask a Clinician', 'Get verified answers from qualified professionals', '⚕️', 8]
  ];

  const insertMany = db.transaction(() => {
    for (const c of categories) {
      insert.run(...c);
    }
  });
  insertMany();
}

function seedCommunityPosts() {
  const postCount = db.prepare('SELECT count(*) as count FROM community_posts').get();
  if (postCount.count > 0) return;

  console.log('Seeding community posts...');

  // Ensure we have a system user for seed posts
  const systemUser = db.prepare('SELECT id FROM users WHERE name = ?').get('NeuroBridge Team');
  let systemUserId = systemUser?.id;
  if (!systemUserId) {
    const result = db.prepare('INSERT INTO users (name, age_string, parent_email, role, display_name) VALUES (?, ?, ?, ?, ?)').run(
      'NeuroBridge Team', '', 'team@neurobridge.ai', 'admin', 'NeuroBridge Team'
    );
    systemUserId = result.lastInsertRowid;
  }

  const clinicianUser = db.prepare('SELECT id FROM users WHERE role = ?').get('clinician');
  let clinicianId = clinicianUser?.id;
  if (!clinicianId) {
    const result = db.prepare('INSERT INTO users (name, age_string, parent_email, role, display_name) VALUES (?, ?, ?, ?, ?)').run(
      'Dr. Emily Carter', '', 'dr.carter@neurobridge.ai', 'clinician', 'Dr. Carter'
    );
    clinicianId = result.lastInsertRowid;
  }

  const insertPost = db.prepare(`
    INSERT INTO community_posts (author_id, category_id, title, content, is_pinned, is_verified, verified_by, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `);

  const seedPosts = [
    // Pinned Welcome Posts
    [systemUserId, 'parenting_tips', '📌 Welcome to NeuroBridge Community!',
      'Welcome to NeuroBridge Community — a safe space for families, therapists, and researchers navigating the autism spectrum together.\n\n🛡️ **Community Guidelines:**\n- Be kind and respectful. Everyone is at a different point in their journey.\n- Share what works for YOUR family — avoid absolute medical advice.\n- Use the "Ask a Clinician" category for medical questions.\n- Report anything that feels unsafe using the flag button.\n\nWe\'re glad you\'re here. 💛', 1, 0, null],

    [systemUserId, 'ask_clinician', '📌 How "Ask a Clinician" Works',
      'This category is special — **only verified clinicians can respond** to ensure medical accuracy.\n\n**How to ask a question:**\n1. Post your question here with as much context as you\'re comfortable sharing.\n2. A verified clinician will respond, usually within 24-48 hours.\n3. Clinician responses are marked with a ✅ badge.\n\n⚠️ **Important:** Answers here are informational, not diagnostic. Always consult your child\'s care team for specific medical decisions.\n\nLet\'s support each other! 🧠', 1, 1, clinicianId],

    // Parenting Tips
    [1, 'parenting_tips', 'Morning routine visual schedule that changed our lives',
      'We struggled with mornings for months — transitions were the worst part of the day. Then I made a simple laminated visual schedule with velcro icons:\n\n1. 🌅 Wake up\n2. 🚿 Bathroom\n3. 👕 Get dressed\n4. 🥣 Breakfast\n5. 🎒 Backpack ready\n6. 🚗 Go time!\n\nMy son (5yo, ASD level 2) now goes through it independently most days. The predictability really helps. We use the "Day Builder" game on NeuroBridge to practice sequencing too!\n\nHas anyone else found visual schedules helpful? What format works for you?', 0, 0, null],

    [1, 'parenting_tips', 'Grocery store strategies for sensory-sensitive kids',
      'Grocery shopping used to be our biggest trigger. Here\'s what finally worked:\n\n- 🎧 Noise-cancelling headphones are non-negotiable\n- 📋 Visual list with pictures of items (he helps check them off)\n- ⏰ Go during off-peak hours (Tuesday 10am is our sweet spot)\n- 🍎 Let him pick ONE surprise item as a reward\n- 🚗 Always have the car as an escape plan\n\nIt\'s not perfect every time, but it went from impossible to manageable. Progress! 💪', 0, 0, null],

    // Therapy Wins
    [1, 'therapy_wins', '🎉 First time my daughter said "I love you"',
      'I know this might seem small to some parents, but after 3 years of speech therapy... my daughter (6yo) said "I love you mama" completely unprompted today.\n\nI ugly cried in the kitchen. 😭💛\n\nFor any parent in the early days feeling like progress is invisible — keep going. It\'s happening even when you can\'t see it. The NeuroBridge screening actually showed her engagement scores improving over the last 6 months, which gave us hope even before this moment.\n\nCelebrate every win, no matter how small. 🎉', 0, 0, null],

    [1, 'therapy_wins', 'Memory Match game streak — 5 days and counting!',
      'My son has been playing the Memory Match game on NeuroBridge for 5 days straight now! 🔥\n\nHis accuracy went from 45% to 72% and he\'s so proud of his streak badge. The adaptive difficulty is perfect — it\'s challenging enough to keep him engaged but not so hard he gets frustrated.\n\nAnyone else\'s kids getting into the therapy games? Which ones are favorites?', 0, 0, null],

    // Daily Challenges
    [1, 'daily_challenges', 'Meltdown at the park — what I learned',
      'Bad day today. Full meltdown at the park because another kid took the swing he wanted. 30 minutes of screaming.\n\nWhat I\'m reminding myself:\n- It\'s not a reflection of my parenting\n- He\'s communicating the only way he can right now\n- Tomorrow is a new day\n- The progress we\'ve made doesn\'t disappear because of one bad moment\n\nSending solidarity to anyone else who had a tough day today. We\'re doing harder work than most people realize. ❤️', 0, 0, null],

    [1, 'daily_challenges', 'Sleep struggles — what actually works?',
      'We\'ve been battling bedtime for weeks. My son (7yo) takes 90+ minutes to fall asleep some nights. We\'ve tried:\n\n- Weighted blanket (helps a little)\n- White noise machine (he likes ocean sounds)\n- Strict no-screens after 7pm\n- Melatonin (asking clinician about this)\n\nWhat has worked for your family? I\'m especially curious about the "Calm Cloud" breathing exercises I\'ve seen mentioned — is that coming to NeuroBridge?', 0, 0, null],

    // Sensory Tools
    [1, 'sensory_tools', 'Our top 5 sensory tools under $20',
      'After 2 years of trial and error, here are our family\'s MVP sensory tools:\n\n1. **Pop-it fidget** ($5) — constant companion\n2. **Chewelry necklace** ($12) — saved us from chewed shirt collars\n3. **Kinetic sand** ($8) — the only thing that calms him down consistently\n4. **Compression vest** ($18) — wearing it during homework = game changer\n5. **Timer cube** ($15) — visual countdown for transitions\n\nTotal: Under $60 for tools we use literally every day. What are your must-haves?', 0, 0, null],

    // School & Education
    [1, 'school_tips', 'IEP meeting tips from a parent who\'s been through 12 of them',
      'Year 4 of IEP meetings and I finally feel like I know what I\'m doing. My tips:\n\n📝 **Before the meeting:**\n- Request draft IEP 5 days ahead (it\'s your RIGHT)\n- Bring your own data (NeuroBridge progress reports are great for this)\n- Write down your top 3 priorities\n\n🗣️ **During the meeting:**\n- You can say "I need time to think about that"\n- Ask "How will this be measured?"\n- Request everything in writing\n\n💪 **Remember:**\n- You are an equal member of the IEP team\n- You can bring an advocate\n- Nothing is final until YOU sign\n\nDon\'t be afraid to push back. You know your child best.', 0, 0, null],

    // Research Corner
    [clinicianId, 'research_corner', 'New study: Early intervention outcomes at 5-year follow-up',
      'Sharing an interesting study from JAMA Pediatrics (2025):\n\n**Key findings:**\n- Children who received ABA + developmental therapy before age 3 showed 40% better adaptive behavior scores at age 8 compared to therapy started after age 5\n- Even "low-intensity" early intervention (10 hrs/week) showed significant benefits\n- Parent-mediated approaches were nearly as effective as clinic-based ones\n\n**What this means for families:**\nEarly screening matters. If you\'re using NeuroBridge\'s screening tools and getting early indicators, that data can help make the case for early intervention with your pediatrician.\n\n*Note: This is a summary for educational purposes. Always discuss treatment decisions with your child\'s care team.*', 0, 1, clinicianId],

    // Ask a Clinician
    [1, 'ask_clinician', 'Is it normal for progress to "plateau" after initial gains?',
      'My daughter (4yo, diagnosed at 2.5) made amazing progress in her first year of therapy — eye contact improved, started using PECS, fewer meltdowns.\n\nBut the last 3 months feel like we\'re stuck. Her NeuroBridge screening scores are stable but not improving. Is this normal? Should we change our approach?\n\nFeeling discouraged and would appreciate a clinician\'s perspective. 🙏', 0, 0, null],
  ];

  const insertMany = db.transaction(() => {
    for (const p of seedPosts) {
      insertPost.run(...p);
    }
  });
  insertMany();
  console.log(`Seeded ${seedPosts.length} community posts.`);
}

initDb();

export default db;

