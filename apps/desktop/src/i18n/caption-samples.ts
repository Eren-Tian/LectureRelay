// Sample caption for the caption style preview in Settings. It shows content in
// the course languages (English source, chosen translation language), so it
// does not change with the interface language and is not part of the UI catalog.
import type { AssistanceLanguage } from '../types/domain';

export const captionSample = {
  source:
    'Learning becomes easier when we connect new ideas to what we already know.',
  translations: {
    zh: '把新知识与已知的事物联系起来，会让学习更轻松。',
    'zh-Hant': '把新知識與已知的事物聯繫起來，會讓學習更輕鬆。',
    ja: '新しい知識を知っていることと結びつけると、学びやすくなります。',
    ko: '새로운 지식을 이미 아는 것과 연결하면 더 쉽게 배울 수 있습니다.',
    vi: 'Việc học trở nên dễ dàng hơn khi chúng ta kết nối kiến thức mới với những gì đã biết.',
    th: 'การเรียนรู้จะง่ายขึ้นเมื่อเราเชื่อมโยงความรู้ใหม่เข้ากับสิ่งที่เรารู้อยู่แล้ว',
    id: 'Belajar menjadi lebih mudah ketika kita menghubungkan pengetahuan baru dengan apa yang sudah kita ketahui.',
    ms: 'Pembelajaran menjadi lebih mudah apabila kita mengaitkan pengetahuan baharu dengan apa yang sudah kita ketahui.',
    hi: 'जब हम नए ज्ञान को पहले से ज्ञात बातों से जोड़ते हैं, तो सीखना आसान हो जाता है।',
    bn: 'নতুন জ্ঞানকে আমরা যা আগে থেকেই জানি তার সঙ্গে যুক্ত করলে শেখা সহজ হয়ে যায়।',
    ur: 'جب ہم نئے علم کو پہلے سے معلوم باتوں سے جوڑتے ہیں تو سیکھنا آسان ہو جاتا ہے۔',
    ar: 'يصبح التعلم أسهل عندما نربط المعرفة الجديدة بما نعرفه بالفعل.',
    fa: 'وقتی دانش جدید را به آنچه از قبل می‌دانیم پیوند می‌دهیم، یادگیری آسان‌تر می‌شود.',
    tr: 'Yeni bilgileri zaten bildiklerimizle ilişkilendirdiğimizde öğrenmek kolaylaşır.',
    ru: 'Учиться становится легче, когда мы связываем новые знания с тем, что уже знаем.',
    uk: 'Навчатися стає легше, коли ми пов’язуємо нові знання з тим, що вже знаємо.',
    es: 'Aprender resulta más fácil cuando conectamos las ideas nuevas con lo que ya sabemos.',
    pt: 'Aprender fica mais fácil quando ligamos novas ideias ao que já sabemos.',
    fr: 'Apprendre devient plus facile quand on relie les nouvelles idées à ce que l’on sait déjà.',
    de: 'Lernen fällt leichter, wenn wir neues Wissen mit dem verknüpfen, was wir schon kennen.',
  } satisfies Record<AssistanceLanguage, string>,
};
