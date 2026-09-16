import type { PracticeUnit } from './types';

export const LESSON_TARGET = 95;

export const lessons = [
  {
    id: 'initials', title: '声母起步', focus: '先找声母，再补韵母',
    description: '从 b、p、m、f 等常见声母开始。每个字输入完整双拼编码，先看清第一键。',
    text: '八怕妈发大他拿拉哥科喝家', syllables: 'ba pa ma fa da ta na la ge ke he jia',
  },
  {
    id: 'finals', title: '韵母定位', focus: '把注意力放在第二键',
    description: '练习 ai、ei、an、ang、en、eng、in、ing 等常见韵母。第二键按错时，需要重打当前字。',
    text: '开飞班帮根更金京多对乱路', syllables: 'kai fei ban bang gen geng jin jing duo dui luan lu',
  },
  {
    id: 'confusions', title: '易混组合', focus: '分清平翘舌与前后鼻音',
    description: '成对练习 z / zh、c / ch、s / sh，以及 in / ing、en / eng。先保证准确，再加快速度。',
    text: '字志次赤四是金京真争新星', syllables: 'zi zhi ci chi si shi jin jing zhen zheng xin xing',
  },
  {
    id: 'sentences', title: '词句连打', focus: '把键位记忆连成输入节奏',
    description: '不必追求速度，一字一字打稳。标点会自动跳过，尝试减少查看逐字提示。',
    text: '每天练习双拼，让输入更轻松。', syllables: 'mei tian lian xi shuang pin rang shu ru geng qing song',
  },
] as const;

export function lessonUnit(id: string): PracticeUnit {
  const lesson = lessons.find(item => item.id === id);
  if (!lesson) throw new Error('未找到这节课程');
  return {
    id: lesson.id, module: 'lesson', text: lesson.text,
    syllables: lesson.syllables.split(' '), source: lesson.title,
    tags: ['新手课程'],
  };
}
