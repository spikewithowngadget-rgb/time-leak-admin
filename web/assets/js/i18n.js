const STORAGE_KEY = "timeleak_admin_lang";

const translations = {
  kz: {
    brand_subtitle: "Ішкі жарнама консолі",
    lang_kz: "Қазақша",
    lang_ru: "Русский",
    lang_en: "English",
    language_label: "Тіл",

    auth_eyebrow: "Admin console",
    auth_hero_title: "Жарнама басқаруы",
    auth_hero_copy: "TimeLeak жарнамаларын басқаруға арналған ішкі жұмыс кеңістігі.",
    auth_metric_status_label: "Жүйе күйі",
    auth_metric_status_value: "Live connection",
    auth_metric_scope_label: "Жұмыс аймағы",
    auth_metric_scope_value: "Ads inventory",
    auth_metric_security_label: "Қауіпсіздік",
    auth_metric_security_value: "Token session",
    auth_points_label: "Жұмыс ағыны",
    auth_point_one: "Белсенді және белсенді емес жарнамаларды бір кестеден қарап шығыңыз.",
    auth_point_two: "Жаңа баннерді бірнеше қадаммен қосып, бірден тексеріңіз.",
    auth_point_three: "Қате немесе ескі жарнамаларды edit және delete арқылы тазалаңыз.",
    auth_badge: "Internal access",
    login_title: "Кіру",
    login_subtitle: "Әкімші тіркелгісімен жүйеге кіріңіз.",
    username_label: "Логин",
    username_placeholder: "Admin",
    password_label: "Құпиясөз",
    password_placeholder: "Құпиясөзді енгізіңіз",
    login_button: "Кіру",
    login_hint: "Тек рұқсат етілген әкімшілерге арналған.",
    auth_support_label: "Сессия",
    auth_support_copy: "Refresh token жарамды болса, жүйе қолжетімділікті фондық режимде жаңартады.",

    sidebar_label: "Жұмыс аймағы",
    nav_overview: "Overview",
    nav_campaigns: "Campaigns",
    nav_reports: "Reports",
    nav_settings: "Settings",
    sidebar_focus_label: "Focus",
    sidebar_focus_title: "Қысқа цикл, таза кесте",
    sidebar_focus_copy: "Бұл интерфейс күнделікті moderation және publish жұмысына бейімделген: артық декор жоқ, негізгі әрекеттер алдыңғы қатарда.",
    sidebar_inventory_copy: "Тізім, іздеу және негізгі CRUD әрекеттері бір жерде.",
    sidebar_filter_copy: "Сүзгі, бет өлшемі және іздеу арқылы керекті жазбаны табыңыз.",
    sidebar_inspector_copy: "Таңдалған жарнаманы оң жақ панельден тексеріңіз.",
    session_label: "Сессия",
    session_copy: "Refresh token белсенді болса, жұмыс үзілмейді.",

    dashboard_eyebrow: "Ads management",
    dashboard_title: "Жарнамалар",
    dashboard_subtitle: "Тізімді бақылаңыз, жазбаны таңдаңыз және өзгерістерді қауіпсіз сақтаңыз.",
    search_placeholder: "Ағымдағы беттен іздеу",
    logout: "Шығу",

    stat_total_label: "Барлық жарнама",
    stat_total_note: "Жүйедегі барлық жазба",
    stat_loaded_label: "Жүктелген жол",
    stat_loaded_note: "Ағымдағы бет",
    stat_active_label: "Белсенді",
    stat_active_note: "Осы беттегі белсенді",
    stat_inactive_label: "Белсенді емес",
    stat_inactive_note: "Осы беттегі белсенді емес",

    table_label: "Тізім",
    table_title: "Жарнама инвентарі",
    filter_active: "Сүзгі",
    filter_all: "Барлығы",
    filter_active_only: "Тек белсенді",
    filter_inactive_only: "Тек белсенді емес",
    limit_label: "Бет өлшемі",
    refresh: "Жаңарту",
    open_create: "Жаңа жарнама",
    col_index: "#",
    col_campaign: "Жарнама",
    col_destination: "Сайт",
    col_status: "Күйі",
    col_created: "Құрылған",
    col_updated: "Жаңартылған",
    col_actions: "Әрекет",
    table_empty_title: "Көрсетуге жарнама жоқ",
    table_empty_copy: "Ағымдағы сүзгі бойынша жазба табылмады. Жаңа жарнама қосыңыз.",
    table_empty_action: "Жарнама қосу",
    prev_page: "Артқа",
    next_page: "Алға",
    offset_label: "Бастапқы орын",
    apply_offset: "Қолдану",

    inspector_label: "Карточка",
    inspector_title: "Таңдалған жазба",
    inspector_empty_title: "Жарнама таңдалмаған",
    inspector_empty_copy: "Толық мәліметті көру үшін кестеден бір жазбаны таңдаңыз.",
    inspector_id: "ID: {id}",
    inspector_target_label: "Мақсатты сілтеме",
    inspector_image_label: "Сурет сілтемесі",
    inspector_status_label: "Күйі",
    inspector_created_label: "Құрылған",
    inspector_updated_label: "Жаңартылған",
    action_copy_link: "Сілтемені көшіру",
    action_edit: "Өңдеу",
    action_delete: "Жою",

    editor_preview_label: "Алдын ала қарау",
    editor_preview_copy: "Сақталғаннан кейін өзгеріс кестеде және карточкада бірден көрінеді.",
    editor_create_title: "Жаңа жарнама қосу",
    editor_create_subtitle: "Міндетті өрістерді толтырыңыз.",
    editor_edit_title: "Жарнаманы өңдеу",
    editor_edit_subtitle: "Тек өзгерген өрістер жіберіледі.",
    cancel: "Бас тарту",
    delete_title: "Жарнаманы жою",
    delete_description: "Бұл әрекет қайтарылмайды. Таңдалған жарнама жүйеден өшіріледі.",
    delete_confirm: "Жою",

    loading_ads: "Жүктелуде...",
    status_active: "Белсенді",
    status_inactive: "Белсенді емес",
    table_summary: "{visible} көрініп тұр, {loaded} жүктелді, {total} барлығы",
    pagination_info: "{start}-{end} / {total}",

    create_button: "Жарнама қосу",
    save_changes: "Өзгерістерді сақтау",
    field_title: "Тақырып",
    field_title_placeholder: "Науқан атауы",
    field_image_url: "Сурет URL",
    field_image_placeholder: "https://cdn.example.com/banner.png",
    field_target_url: "Target URL",
    field_target_placeholder: "https://example.com/promo",
    field_is_active: "Белсенді күйде жариялау",

    toast_login_success: "Кіру орындалды",
    toast_session_expired: "Сессия аяқталды. Қайта кіріңіз.",
    toast_created: "Жарнама құрылды",
    toast_saved: "Өзгерістер сақталды",
    toast_deleted: "Жарнама жойылды",
    toast_toggled: "Күйі жаңартылды",
    toast_no_changes: "Өзгеріс табылмады",
    toast_copied: "Сілтеме көшірілді",
    toast_copy_failed: "Көшіру мүмкін болмады",

    login_invalid_credentials: "Логин немесе құпиясөз қате.",
    validation_required: "{field} міндетті",
    validation_url: "{field} http немесе https URL болуы керек",

    api_400: "Қате сұраныс (400)",
    api_401: "Авторизация қажет (401)",
    api_403: "Қол жеткізу тыйым салынған (403)",
    api_404: "Ресурс табылмады (404)",
    api_500: "Сервер қатесі (500)",
    api_network: "Желі қатесі. Қосылымды тексеріңіз.",
    api_unknown: "Белгісіз қате",
  },

  ru: {
    brand_subtitle: "Внутренняя рекламная консоль",
    lang_kz: "Қазақша",
    lang_ru: "Русский",
    lang_en: "English",
    language_label: "Язык",

    auth_eyebrow: "Admin console",
    auth_hero_title: "Управление рекламой",
    auth_hero_copy: "Внутреннее рабочее пространство для рекламы TimeLeak.",
    auth_metric_status_label: "Состояние системы",
    auth_metric_status_value: "Live connection",
    auth_metric_scope_label: "Рабочая зона",
    auth_metric_scope_value: "Ads inventory",
    auth_metric_security_label: "Безопасность",
    auth_metric_security_value: "Token session",
    auth_points_label: "Рабочий поток",
    auth_point_one: "Проверяйте активные и неактивные объявления из одной таблицы.",
    auth_point_two: "Создавайте новый баннер за несколько шагов и сразу проверяйте его.",
    auth_point_three: "Чистите старые или ошибочные записи через edit и delete.",
    auth_badge: "Internal access",
    login_title: "Вход",
    login_subtitle: "Войдите под учетной записью администратора.",
    username_label: "Логин",
    username_placeholder: "Admin",
    password_label: "Пароль",
    password_placeholder: "Введите пароль",
    login_button: "Войти",
    login_hint: "Только для авторизованных администраторов.",
    auth_support_label: "Сессия",
    auth_support_copy: "Пока refresh token действителен, система обновляет доступ в фоне.",

    sidebar_label: "Рабочая область",
    nav_overview: "Overview",
    nav_campaigns: "Campaigns",
    nav_reports: "Reports",
    nav_settings: "Settings",
    sidebar_focus_label: "Focus",
    sidebar_focus_title: "Короткий цикл, понятная таблица",
    sidebar_focus_copy: "Интерфейс собран под повседневную модерацию и публикацию: без визуального шума, с быстрыми основными действиями.",
    sidebar_inventory_copy: "Список, поиск и основные CRUD-действия собраны в одном месте.",
    sidebar_filter_copy: "Фильтры и пагинация помогают быстро находить нужные записи.",
    sidebar_inspector_copy: "Проверяйте выбранное объявление в правой панели.",
    session_label: "Сессия",
    session_copy: "Работа продолжается, пока refresh token остается действительным.",

    dashboard_eyebrow: "Ads management",
    dashboard_title: "Объявления",
    dashboard_subtitle: "Контролируйте список, выбирайте запись и безопасно сохраняйте изменения.",
    search_placeholder: "Поиск по текущей странице",
    logout: "Выйти",

    stat_total_label: "Всего объявлений",
    stat_total_note: "Все записи в системе",
    stat_loaded_label: "Загружено строк",
    stat_loaded_note: "Текущая страница",
    stat_active_label: "Активные",
    stat_active_note: "Активные на текущей странице",
    stat_inactive_label: "Неактивные",
    stat_inactive_note: "Неактивные на текущей странице",

    table_label: "Список",
    table_title: "Инвентарь рекламы",
    filter_active: "Фильтр",
    filter_all: "Все",
    filter_active_only: "Только активные",
    filter_inactive_only: "Только неактивные",
    limit_label: "Размер страницы",
    refresh: "Обновить",
    open_create: "Новое объявление",
    col_index: "#",
    col_campaign: "Объявление",
    col_destination: "Сайт",
    col_status: "Статус",
    col_created: "Создано",
    col_updated: "Обновлено",
    col_actions: "Действия",
    table_empty_title: "Нечего показывать",
    table_empty_copy: "По текущему фильтру записи не найдены. Добавьте новое объявление.",
    table_empty_action: "Добавить объявление",
    prev_page: "Назад",
    next_page: "Вперед",
    offset_label: "Смещение",
    apply_offset: "Применить",

    inspector_label: "Карточка",
    inspector_title: "Выбранная запись",
    inspector_empty_title: "Объявление не выбрано",
    inspector_empty_copy: "Выберите запись в таблице, чтобы посмотреть подробности.",
    inspector_id: "ID: {id}",
    inspector_target_label: "Сайт",
    inspector_image_label: "Ссылка на изображение",
    inspector_status_label: "Статус",
    inspector_created_label: "Создано",
    inspector_updated_label: "Обновлено",
    action_copy_link: "Копировать ссылку",
    action_edit: "Изменить",
    action_delete: "Удалить",

    editor_preview_label: "Предпросмотр",
    editor_preview_copy: "После сохранения изменение сразу появится в таблице и карточке.",
    editor_create_title: "Создать объявление",
    editor_create_subtitle: "Заполните обязательные поля.",
    editor_edit_title: "Редактировать объявление",
    editor_edit_subtitle: "На сервер отправляются только измененные поля.",
    cancel: "Отмена",
    delete_title: "Удалить объявление",
    delete_description: "Это действие нельзя отменить. Запись будет удалена из системы.",
    delete_confirm: "Удалить",

    loading_ads: "Загрузка...",
    status_active: "Активно",
    status_inactive: "Неактивно",
    table_summary: "Видно {visible}, загружено {loaded}, всего {total}",
    pagination_info: "{start}-{end} из {total}",

    create_button: "Создать объявление",
    save_changes: "Сохранить изменения",
    field_title: "Заголовок",
    field_title_placeholder: "Название кампании",
    field_image_url: "URL изображения",
    field_image_placeholder: "https://cdn.example.com/banner.png",
    field_target_url: "Target URL",
    field_target_placeholder: "https://example.com/promo",
    field_is_active: "Опубликовать как активное",

    toast_login_success: "Вход выполнен",
    toast_session_expired: "Сессия завершилась. Войдите снова.",
    toast_created: "Объявление создано",
    toast_saved: "Изменения сохранены",
    toast_deleted: "Объявление удалено",
    toast_toggled: "Статус обновлен",
    toast_no_changes: "Изменений нет",
    toast_copied: "Ссылка скопирована",
    toast_copy_failed: "Не удалось скопировать",

    login_invalid_credentials: "Неверный логин или пароль.",
    validation_required: "Поле {field} обязательно",
    validation_url: "Поле {field} должно быть корректным http или https URL",

    api_400: "Некорректный запрос (400)",
    api_401: "Требуется авторизация (401)",
    api_403: "Доступ запрещен (403)",
    api_404: "Ресурс не найден (404)",
    api_500: "Ошибка сервера (500)",
    api_network: "Сетевая ошибка. Проверьте подключение.",
    api_unknown: "Неизвестная ошибка",
  },

  en: {
    brand_subtitle: "Internal advertising console",
    lang_kz: "Қазақша",
    lang_ru: "Русский",
    lang_en: "English",
    language_label: "Language",

    auth_eyebrow: "Admin console",
    auth_hero_title: "Advertising control",
    auth_hero_copy: "Internal workspace for managing TimeLeak advertising.",
    auth_metric_status_label: "System status",
    auth_metric_status_value: "Live connection",
    auth_metric_scope_label: "Workspace",
    auth_metric_scope_value: "Ads inventory",
    auth_metric_security_label: "Security",
    auth_metric_security_value: "Token session",
    auth_points_label: "Workflow",
    auth_point_one: "Review active and inactive ads from a single table.",
    auth_point_two: "Publish new banners in a few fields and verify them immediately.",
    auth_point_three: "Clean up stale or broken entries with fast edit and delete actions.",
    auth_badge: "Internal access",
    login_title: "Sign in",
    login_subtitle: "Use your administrator account to continue.",
    username_label: "Username",
    username_placeholder: "Admin",
    password_label: "Password",
    password_placeholder: "Enter password",
    login_button: "Sign in",
    login_hint: "Restricted to authorized administrators.",
    auth_support_label: "Session",
    auth_support_copy: "The console refreshes access in the background while the refresh token remains valid.",

    sidebar_label: "Workspace",
    nav_overview: "Overview",
    nav_campaigns: "Campaigns",
    nav_reports: "Reports",
    nav_settings: "Settings",
    sidebar_focus_label: "Focus",
    sidebar_focus_title: "Short loop, cleaner table",
    sidebar_focus_copy: "The interface is tuned for daily moderation and publishing: less decoration, faster primary actions.",
    sidebar_inventory_copy: "List management, search, and CRUD actions are kept in one place.",
    sidebar_filter_copy: "Use filters, paging, and search to move through records quickly.",
    sidebar_inspector_copy: "Review the selected ad from the detail panel on the right.",
    session_label: "Session",
    session_copy: "Work continues while the refresh token remains valid.",

    dashboard_eyebrow: "Ads management",
    dashboard_title: "Advertisements",
    dashboard_subtitle: "Monitor the list, select a record, and save changes with less friction.",
    search_placeholder: "Search current page",
    logout: "Logout",

    stat_total_label: "Total ads",
    stat_total_note: "All records in the system",
    stat_loaded_label: "Loaded rows",
    stat_loaded_note: "Current page",
    stat_active_label: "Active rows",
    stat_active_note: "Active on this page",
    stat_inactive_label: "Inactive rows",
    stat_inactive_note: "Inactive on this page",

    table_label: "List",
    table_title: "Ad inventory",
    filter_active: "Filter",
    filter_all: "All",
    filter_active_only: "Active only",
    filter_inactive_only: "Inactive only",
    limit_label: "Page size",
    refresh: "Refresh",
    open_create: "New ad",
    col_index: "#",
    col_campaign: "Campaign",
    col_destination: "Site",
    col_status: "Status",
    col_created: "Created",
    col_updated: "Updated",
    col_actions: "Actions",
    table_empty_title: "Nothing to display",
    table_empty_copy: "No records match the current filter. Create a new ad to get started.",
    table_empty_action: "Create ad",
    prev_page: "Previous",
    next_page: "Next",
    offset_label: "Start at",
    apply_offset: "Apply",

    inspector_label: "Details",
    inspector_title: "Selected record",
    inspector_empty_title: "No ad selected",
    inspector_empty_copy: "Select a row in the table to review the record details.",
    inspector_id: "ID: {id}",
    inspector_target_label: "Target site",
    inspector_image_label: "Image URL",
    inspector_status_label: "Status",
    inspector_created_label: "Created",
    inspector_updated_label: "Updated",
    action_copy_link: "Copy link",
    action_edit: "Edit",
    action_delete: "Delete",

    editor_preview_label: "Preview",
    editor_preview_copy: "Saved changes appear in the table and the detail card as soon as the request completes.",
    editor_create_title: "Create new ad",
    editor_create_subtitle: "Fill in the required fields.",
    editor_edit_title: "Edit ad",
    editor_edit_subtitle: "Only changed fields are sent to the backend.",
    cancel: "Cancel",
    delete_title: "Delete ad",
    delete_description: "This action is permanent. The selected record will be removed from the system.",
    delete_confirm: "Delete",

    loading_ads: "Loading...",
    status_active: "Active",
    status_inactive: "Inactive",
    table_summary: "{visible} visible, {loaded} loaded, {total} total",
    pagination_info: "{start}-{end} of {total}",

    create_button: "Create ad",
    save_changes: "Save changes",
    field_title: "Title",
    field_title_placeholder: "Campaign name",
    field_image_url: "Image URL",
    field_image_placeholder: "https://cdn.example.com/banner.png",
    field_target_url: "Target URL",
    field_target_placeholder: "https://example.com/promo",
    field_is_active: "Publish as active",

    toast_login_success: "Login successful",
    toast_session_expired: "Your session ended. Sign in again.",
    toast_created: "Ad created",
    toast_saved: "Changes saved",
    toast_deleted: "Ad deleted",
    toast_toggled: "Status updated",
    toast_no_changes: "No changes detected",
    toast_copied: "Link copied",
    toast_copy_failed: "Unable to copy link",

    login_invalid_credentials: "Invalid username or password.",
    validation_required: "{field} is required",
    validation_url: "{field} must be a valid http or https URL",

    api_400: "Bad request (400)",
    api_401: "Authorization required (401)",
    api_403: "Forbidden (403)",
    api_404: "Resource not found (404)",
    api_500: "Server error (500)",
    api_network: "Network error. Check your connection.",
    api_unknown: "Unknown error",
  },
};

let currentLanguage = resolveInitialLanguage();

function resolveInitialLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && translations[stored]) {
    return stored;
  }

  return "kz";
}

export function getLanguage() {
  return currentLanguage;
}

export function setLanguage(languageCode) {
  if (!translations[languageCode]) {
    return;
  }

  currentLanguage = languageCode;
  localStorage.setItem(STORAGE_KEY, languageCode);
  applyTranslations(document);
  document.dispatchEvent(new CustomEvent("languagechange", { detail: languageCode }));
}

export function t(key, params = {}) {
  const value = (translations[currentLanguage] && translations[currentLanguage][key]) || translations.en[key] || key;
  return value.replace(/\{(\w+)\}/g, (_, token) => String(params[token] ?? `{${token}}`));
}

export function applyTranslations(root = document) {
  const languageMap = {
    kz: "kk",
    ru: "ru",
    en: "en",
  };

  if (root === document) {
    document.documentElement.lang = languageMap[currentLanguage] || "en";
  }

  root.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    node.textContent = t(key);
  });

  root.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.getAttribute("data-i18n-placeholder");
    node.setAttribute("placeholder", t(key));
  });
}

export function initLanguageSelect(selectElement) {
  if (!selectElement) {
    return;
  }

  selectElement.value = currentLanguage;
  selectElement.addEventListener("change", () => {
    setLanguage(selectElement.value);
  });
}
