/* webinar-room-pro — конфігурація v1
 *
 * УВАГА: LiveKit-підключення вимкнено, доки не заповнено LIVEKIT_URL і TOKEN_ENDPOINT.
 * 1. LIVEKIT_URL — WebSocket-адреса вашого LiveKit-сервера (плейсхолдер, нічого не вигадуємо).
 * 2. TOKEN_ENDPOINT — адреса вашого серверного endpoint, що видає JWT-токени LiveKit
 *    для глядачів (POST { identity, room } → { token }). Бекенд ще не написано —
 *    коли будуть реквізити, реалізуємо.
 * Поки обидва порожні — кімната працює в режимі симуляції ефіру (як раніше).
 */
window.WEBINAR_CONFIG = {
  /* --- LiveKit (плейсхолдери; заповнить Vanya, коли будуть ключі) --- */
  LIVEKIT_URL: '',        // напр. 'wss://your-project.livekit.cloud'
  TOKEN_ENDPOINT: '',     // напр. 'https://your-backend.example.com/api/livekit-token'
  ROOM_NAME: 'ik-webinar',

  /* --- рекрутингова воронка --- */
  PITCH_MOMENT: 90,       // секунд після старту LIVE до авто-показу CTA «Приєднатися до команди»
  POLL_DELAY_1: 60,       // секунд після старту LIVE до першого опитування
  POLL_DELAY_2: 150,      // секунд після старту LIVE до другого опитування

  /* --- Telegram-бот (єдине джерело правди для CTA) --- */
  TG_BOT: 'https://t.me/ivankosovych_bot',

  /* --- опитування під час LIVE (питання ведучого) --- */
  POLLS: [
    {
      id: 'goals',
      question: 'Що для вас головне у партнерстві?',
      options: ['Додатковий дохід', 'Свій бізнес', 'Команда і підтримка', 'Поки дивлюсь']
    },
    {
      id: 'ready',
      question: 'Готові стартувати цього тижня?',
      options: ['Так, хочу дзвінок', 'Так, сам розберусь', 'Ще думаю', 'Ні']
    }
  ],

  /* --- скоринг: бали за дії (v1.1: розшириться подіями evergreen) --- */
  SCORE: {
    qualification: 20,  // пройдена кваліфікація при вході
    watchMinute: 5,     // кожна хвилина перегляду LIVE
    chatMessage: 10,    // повідомлення в чаті
    reaction: 3,        // реакція
    pollVote: 15,       // голос в опитуванні
    ctaClick: 25        // клік по CTA «Приєднатися до команди»
  },
  LEVEL_HOT: 100,       // ≥ 100 балів → 🔥 гарячий
  LEVEL_WARM: 40,       // ≥ 40 балів → 🟡 теплий, інакше ⚪ холодний

  /* --- evergreen 24/7: ротація записаних вебінарів як «прямий ефір» --- */
  EVERGREEN: true,            // false — повернути звичайний розклад (четвер 19:00)
  EVERGREEN_SESSION_MIN: 3,   // «почався N хв тому»: мінімум хвилин
  EVERGREEN_SESSION_MAX: 12,  // максимум хвилин
  EVERGREEN_POLL_AT: [480, 1140],  // секунди ВІД ПОЧАТКУ ВЕБІНАРУ → опитування POLLS[0], POLLS[1]
  EVERGREEN_PITCH_AT: 1500,        // секунда від початку вебінару → авто-показ CTA
  // окремий вебінар у playlist.json може перевизначити через поля pitchAt / pollAt

  /* --- розклад РЕАЛЬНИХ ефірів (evergreen заповнює паузи між ними) --- */
  WEEKDAY: 4,           // 0=нд … 4=чт
  START_HOUR: 19
};
