export type Category =
  | "General"
  | "Technology"
  | "Business"
  | "Society"
  | "Fun"
  | "Debate"
  | "Hot Takes";

export type Difficulty = "Easy" | "Medium" | "Hard";

export interface Topic {
  id: string;
  text: string;
  category: Category;
  difficulty: Difficulty;
}

export const CATEGORIES: readonly Category[] = [
  "General",
  "Technology",
  "Business",
  "Society",
  "Fun",
  "Debate",
  "Hot Takes",
] as const;

export const DIFFICULTIES: readonly Difficulty[] = [
  "Easy",
  "Medium",
  "Hard",
] as const;

const topics: Topic[] = [
  // ── General / Easy ──
  { id: "g01", text: "What is one habit you wish you could build?", category: "General", difficulty: "Easy" },
  { id: "g02", text: "What would you do with an extra hour every day?", category: "General", difficulty: "Easy" },
  { id: "g03", text: "What skill should every person learn before age 20?", category: "General", difficulty: "Easy" },
  { id: "g04", text: "If you could have dinner with anyone, who and why?", category: "General", difficulty: "Easy" },
  { id: "g05", text: "What is the best advice you have ever received?", category: "General", difficulty: "Easy" },
  { id: "g06", text: "Describe your perfect morning routine.", category: "General", difficulty: "Easy" },
  { id: "g07", text: "What is the most interesting thing you learned this week?", category: "General", difficulty: "Easy" },
  { id: "g08", text: "If you could live anywhere for a year, where would you go?", category: "General", difficulty: "Easy" },
  { id: "g09", text: "What makes a good friend?", category: "General", difficulty: "Easy" },
  { id: "g10", text: "Talk about a book, movie, or show that changed your perspective.", category: "General", difficulty: "Easy" },
  { id: "g11", text: "What is a small act of kindness you will never forget?", category: "General", difficulty: "Easy" },
  { id: "g12", text: "If you had unlimited money for one day, what would you do?", category: "General", difficulty: "Easy" },
  { id: "g13", text: "What is the best meal you have ever had?", category: "General", difficulty: "Easy" },
  { id: "g14", text: "What hobby have you always wanted to pick up?", category: "General", difficulty: "Easy" },
  { id: "g15", text: "Describe a place that feels like home to you.", category: "General", difficulty: "Easy" },

  // ── General / Medium ──
  { id: "g16", text: "What does success mean to you?", category: "General", difficulty: "Medium" },
  { id: "g17", text: "How has your definition of happiness changed over time?", category: "General", difficulty: "Medium" },
  { id: "g18", text: "What is a misconception people often have about you?", category: "General", difficulty: "Medium" },
  { id: "g19", text: "If you could change one thing about how you were raised, what would it be?", category: "General", difficulty: "Medium" },
  { id: "g20", text: "What is the hardest decision you have ever made?", category: "General", difficulty: "Medium" },
  { id: "g21", text: "Talk about a time when you failed and what you learned.", category: "General", difficulty: "Medium" },
  { id: "g22", text: "How do you deal with stress or anxiety?", category: "General", difficulty: "Medium" },
  { id: "g23", text: "What role does gratitude play in your life?", category: "General", difficulty: "Medium" },
  { id: "g24", text: "Describe a turning point in your life.", category: "General", difficulty: "Medium" },
  { id: "g25", text: "What does it mean to live a meaningful life?", category: "General", difficulty: "Medium" },

  // ── General / Hard ──
  { id: "g26", text: "Is it possible to be truly selfless?", category: "General", difficulty: "Hard" },
  { id: "g27", text: "How do you balance ambition with contentment?", category: "General", difficulty: "Hard" },
  { id: "g28", text: "Should people prioritize career or relationships?", category: "General", difficulty: "Hard" },
  { id: "g29", text: "What responsibility do we have to future generations?", category: "General", difficulty: "Hard" },
  { id: "g30", text: "Is it better to be feared or respected?", category: "General", difficulty: "Hard" },

  // ── Technology / Easy ──
  { id: "t01", text: "What is the most useful app on your phone and why?", category: "Technology", difficulty: "Easy" },
  { id: "t02", text: "Do you think kids should learn to code?", category: "Technology", difficulty: "Easy" },
  { id: "t03", text: "What is one piece of technology you could not live without?", category: "Technology", difficulty: "Easy" },
  { id: "t04", text: "How has technology changed the way we communicate?", category: "Technology", difficulty: "Easy" },
  { id: "t05", text: "What is your favorite gadget and why?", category: "Technology", difficulty: "Easy" },
  { id: "t06", text: "Would you let a robot clean your house?", category: "Technology", difficulty: "Easy" },
  { id: "t07", text: "What technology from science fiction do you wish existed?", category: "Technology", difficulty: "Easy" },
  { id: "t08", text: "How do you feel about voice assistants like Siri or Alexa?", category: "Technology", difficulty: "Easy" },
  { id: "t09", text: "What is one tech habit you want to break?", category: "Technology", difficulty: "Easy" },
  { id: "t10", text: "Should there be an age limit for social media?", category: "Technology", difficulty: "Easy" },

  // ── Technology / Medium ──
  { id: "t11", text: "Should children under 12 have smartphones?", category: "Technology", difficulty: "Medium" },
  { id: "t12", text: "What invention from the last 10 years matters most?", category: "Technology", difficulty: "Medium" },
  { id: "t13", text: "How will AI change the job market in the next decade?", category: "Technology", difficulty: "Medium" },
  { id: "t14", text: "Is it ethical for companies to collect user data?", category: "Technology", difficulty: "Medium" },
  { id: "t15", text: "Explain quantum computing to a five-year-old.", category: "Technology", difficulty: "Medium" },
  { id: "t16", text: "Will self-driving cars make roads safer or more dangerous?", category: "Technology", difficulty: "Medium" },
  { id: "t17", text: "Should social media platforms be regulated like utilities?", category: "Technology", difficulty: "Medium" },
  { id: "t18", text: "How is technology changing education for better or worse?", category: "Technology", difficulty: "Medium" },
  { id: "t19", text: "Is our addiction to screens a genuine health crisis?", category: "Technology", difficulty: "Medium" },
  { id: "t20", text: "What is the next big breakthrough in technology?", category: "Technology", difficulty: "Medium" },

  // ── Technology / Hard ──
  { id: "t21", text: "AI will create more jobs than it destroys.", category: "Technology", difficulty: "Hard" },
  { id: "t22", text: "Should governments regulate AI development?", category: "Technology", difficulty: "Hard" },
  { id: "t23", text: "Can technology solve climate change?", category: "Technology", difficulty: "Hard" },
  { id: "t24", text: "Should there be a universal right to internet access?", category: "Technology", difficulty: "Hard" },
  { id: "t25", text: "Will artificial general intelligence be a net positive for humanity?", category: "Technology", difficulty: "Hard" },
  { id: "t26", text: "Are tech monopolies inevitable or preventable?", category: "Technology", difficulty: "Hard" },
  { id: "t27", text: "Should we fear or welcome brain-computer interfaces?", category: "Technology", difficulty: "Hard" },
  { id: "t28", text: "Does the convenience of technology outweigh its cost to privacy?", category: "Technology", difficulty: "Hard" },
  { id: "t29", text: "Is open-source software a sustainable model?", category: "Technology", difficulty: "Hard" },
  { id: "t30", text: "Should algorithms be transparent and auditable by law?", category: "Technology", difficulty: "Hard" },

  // ── Business / Easy ──
  { id: "b01", text: "If you started a company tomorrow, what would it do?", category: "Business", difficulty: "Easy" },
  { id: "b02", text: "What makes a great boss?", category: "Business", difficulty: "Easy" },
  { id: "b03", text: "Describe the worst job you have ever had.", category: "Business", difficulty: "Easy" },
  { id: "b04", text: "What is the best work perk you can imagine?", category: "Business", difficulty: "Easy" },
  { id: "b05", text: "Would you rather work at a startup or a big company?", category: "Business", difficulty: "Easy" },
  { id: "b06", text: "What is one thing every office should have?", category: "Business", difficulty: "Easy" },
  { id: "b07", text: "If you could automate one part of your job, what would it be?", category: "Business", difficulty: "Easy" },
  { id: "b08", text: "What is the most important quality in a coworker?", category: "Business", difficulty: "Easy" },
  { id: "b09", text: "Should meetings have a maximum length?", category: "Business", difficulty: "Easy" },
  { id: "b10", text: "What is the best career advice you would give to a new graduate?", category: "Business", difficulty: "Easy" },

  // ── Business / Medium ──
  { id: "b11", text: "Is a four-day work week better for everyone?",  category: "Business", difficulty: "Medium" },
  { id: "b12", text: "The best leaders are introverts.", category: "Business", difficulty: "Medium" },
  { id: "b13", text: "Should companies require employees to return to the office?", category: "Business", difficulty: "Medium" },
  { id: "b14", text: "How important is company culture versus salary?", category: "Business", difficulty: "Medium" },
  { id: "b15", text: "Is hustle culture productive or toxic?",  category: "Business", difficulty: "Medium" },
  { id: "b16", text: "Should CEOs earn more than 100 times their median employee?", category: "Business", difficulty: "Medium" },
  { id: "b17", text: "What role should businesses play in social issues?", category: "Business", difficulty: "Medium" },
  { id: "b18", text: "Is mentorship overrated or underrated?", category: "Business", difficulty: "Medium" },
  { id: "b19", text: "How do you handle disagreements at work?", category: "Business", difficulty: "Medium" },
  { id: "b20", text: "What makes a product go viral?", category: "Business", difficulty: "Medium" },

  // ── Business / Hard ──
  { id: "b21", text: "Is capitalism the best economic system we have?", category: "Business", difficulty: "Hard" },
  { id: "b22", text: "Should profit ever take priority over ethics?", category: "Business", difficulty: "Hard" },
  { id: "b23", text: "Will automation lead to mass unemployment?", category: "Business", difficulty: "Hard" },
  { id: "b24", text: "Should there be a maximum wage?", category: "Business", difficulty: "Hard" },
  { id: "b25", text: "Is universal basic income inevitable?", category: "Business", difficulty: "Hard" },
  { id: "b26", text: "Can a company be truly ethical and still maximize shareholder value?", category: "Business", difficulty: "Hard" },
  { id: "b27", text: "Should gig workers receive the same benefits as full-time employees?",  category: "Business", difficulty: "Hard" },
  { id: "b28", text: "Is globalization a force for good or harm?", category: "Business", difficulty: "Hard" },

  // ── Society / Easy ──
  { id: "s01", text: "What is one law you would create if you could?", category: "Society", difficulty: "Easy" },
  { id: "s02", text: "What makes a good neighbor?", category: "Society", difficulty: "Easy" },
  { id: "s03", text: "Should tipping be mandatory or abolished?", category: "Society", difficulty: "Easy" },
  { id: "s04", text: "What is the most important value to teach children?", category: "Society", difficulty: "Easy" },
  { id: "s05", text: "Is it important to know your neighbors?", category: "Society", difficulty: "Easy" },
  { id: "s06", text: "What tradition should every family have?", category: "Society", difficulty: "Easy" },
  { id: "s07", text: "Should public transport be free for everyone?", category: "Society", difficulty: "Easy" },
  { id: "s08", text: "What is one thing that would make your city better?", category: "Society", difficulty: "Easy" },
  { id: "s09", text: "Is it important to learn a second language?", category: "Society", difficulty: "Easy" },
  { id: "s10", text: "What does community mean to you?", category: "Society", difficulty: "Easy" },

  // ── Society / Medium ──
  { id: "s11", text: "What cultural tradition should the whole world adopt?", category: "Society", difficulty: "Medium" },
  { id: "s12", text: "Is political correctness helping or hurting society?", category: "Society", difficulty: "Medium" },
  { id: "s13", text: "Should the voting age be lowered to 16?", category: "Society", difficulty: "Medium" },
  { id: "s14", text: "How should society deal with misinformation?", category: "Society", difficulty: "Medium" },
  { id: "s15", text: "Is the education system preparing students for real life?", category: "Society", difficulty: "Medium" },
  { id: "s16", text: "What role should religion play in public policy?", category: "Society", difficulty: "Medium" },
  { id: "s17", text: "Should healthcare be a fundamental right?", category: "Society", difficulty: "Medium" },
  { id: "s18", text: "How do you define justice?", category: "Society", difficulty: "Medium" },
  { id: "s19", text: "Is social media making us more or less empathetic?", category: "Society", difficulty: "Medium" },
  { id: "s20", text: "What is the biggest challenge facing your generation?", category: "Society", difficulty: "Medium" },

  // ── Society / Hard ──
  { id: "s21", text: "Should voting be mandatory in a democracy?", category: "Society", difficulty: "Hard" },
  { id: "s22", text: "Is cancel culture a net positive for society?", category: "Society", difficulty: "Hard" },
  { id: "s23", text: "Privacy is dead. Is that okay?", category: "Society", difficulty: "Hard" },
  { id: "s24", text: "Should countries have open borders?", category: "Society", difficulty: "Hard" },
  { id: "s25", text: "Is meritocracy a myth?", category: "Society", difficulty: "Hard" },
  { id: "s26", text: "Should the death penalty be abolished worldwide?", category: "Society", difficulty: "Hard" },
  { id: "s27", text: "Can a society achieve true equality?", category: "Society", difficulty: "Hard" },
  { id: "s28", text: "Is nationalism ever a force for good?", category: "Society", difficulty: "Hard" },
  { id: "s29", text: "Should governments prioritize individual freedom or collective safety?", category: "Society", difficulty: "Hard" },
  { id: "s30", text: "Is it ethical to bring children into an uncertain world?", category: "Society", difficulty: "Hard" },

  // ── Fun / Easy ──
  { id: "f01", text: "Pitch a new holiday that the world needs.", category: "Fun", difficulty: "Easy" },
  { id: "f02", text: "Describe your ideal weekend with zero budget.", category: "Fun", difficulty: "Easy" },
  { id: "f03", text: "Invent a sport that combines two existing ones.", category: "Fun", difficulty: "Easy" },
  { id: "f04", text: "If you were a superhero, what would your power be?", category: "Fun", difficulty: "Easy" },
  { id: "f05", text: "What is the worst fashion trend of all time?", category: "Fun", difficulty: "Easy" },
  { id: "f06", text: "You can only eat one food for the rest of your life. What is it?", category: "Fun", difficulty: "Easy" },
  { id: "f07", text: "Describe the weirdest dream you have ever had.", category: "Fun", difficulty: "Easy" },
  { id: "f08", text: "If animals could talk, which would be the rudest?", category: "Fun", difficulty: "Easy" },
  { id: "f09", text: "What would your TED Talk be about?", category: "Fun", difficulty: "Easy" },
  { id: "f10", text: "If you could time-travel, would you go to the past or future?", category: "Fun", difficulty: "Easy" },
  { id: "f11", text: "What is the strangest thing you have ever eaten?", category: "Fun", difficulty: "Easy" },
  { id: "f12", text: "You are in charge of a theme park. What is the theme?", category: "Fun", difficulty: "Easy" },
  { id: "f13", text: "If you could swap lives with anyone for a day, who would it be?", category: "Fun", difficulty: "Easy" },
  { id: "f14", text: "What is the most overrated movie of all time?", category: "Fun", difficulty: "Easy" },
  { id: "f15", text: "Describe your dream house in 60 seconds.", category: "Fun", difficulty: "Easy" },

  // ── Fun / Medium ──
  { id: "f16", text: "Design the perfect school from scratch.", category: "Fun", difficulty: "Medium" },
  { id: "f17", text: "If you could add one subject to every school curriculum, what would it be?", category: "Fun", difficulty: "Medium" },
  { id: "f18", text: "Create a one-minute pitch for a ridiculous startup idea.", category: "Fun", difficulty: "Medium" },
  { id: "f19", text: "If you had to give a commencement speech right now, what would you say?", category: "Fun", difficulty: "Medium" },
  { id: "f20", text: "You are stranded on a desert island with three items. What do you bring?", category: "Fun", difficulty: "Medium" },
  { id: "f21", text: "Explain a complicated topic as if you were talking to a five-year-old.", category: "Fun", difficulty: "Medium" },
  { id: "f22", text: "Pitch a movie sequel that should never be made.", category: "Fun", difficulty: "Medium" },
  { id: "f23", text: "If you could rename any country, which and why?", category: "Fun", difficulty: "Medium" },
  { id: "f24", text: "Describe a day in your life 50 years from now.", category: "Fun", difficulty: "Medium" },
  { id: "f25", text: "Create a new rule for an existing board game.", category: "Fun", difficulty: "Medium" },

  // ── Fun / Hard ──
  { id: "f26", text: "Convince an alien that Earth is worth visiting.", category: "Fun", difficulty: "Hard" },
  { id: "f27", text: "Give a eulogy for the last piece of pizza.", category: "Fun", difficulty: "Hard" },
  { id: "f28", text: "Defend the most boring hobby you can think of.", category: "Fun", difficulty: "Hard" },
  { id: "f29", text: "Pitch yourself as a product. What is your unique selling point?", category: "Fun", difficulty: "Hard" },
  { id: "f30", text: "Tell the story of your life using only questions.", category: "Fun", difficulty: "Hard" },

  // ── Debate / Easy ──
  { id: "d01", text: "Is it better to be an early bird or a night owl?", category: "Debate", difficulty: "Easy" },
  { id: "d02", text: "Are cats better pets than dogs?", category: "Debate", difficulty: "Easy" },
  { id: "d03", text: "Is it better to save money or spend it on experiences?", category: "Debate", difficulty: "Easy" },
  { id: "d04", text: "Should homework be banned?", category: "Debate", difficulty: "Easy" },
  { id: "d05", text: "Is it better to live in the city or the countryside?", category: "Debate", difficulty: "Easy" },
  { id: "d06", text: "Should every country have a four-day school week?", category: "Debate", difficulty: "Easy" },
  { id: "d07", text: "Is summer or winter the better season?", category: "Debate", difficulty: "Easy" },
  { id: "d08", text: "Would you rather be famous or anonymous?", category: "Debate", difficulty: "Easy" },
  { id: "d09", text: "Is it better to rent or buy a home?", category: "Debate", difficulty: "Easy" },
  { id: "d10", text: "Should fast food come with health warnings?", category: "Debate", difficulty: "Easy" },

  // ── Debate / Medium ──
  { id: "d11", text: "Should all drugs be decriminalized?", category: "Debate", difficulty: "Medium" },
  { id: "d12", text: "Is it ethical to eat meat?", category: "Debate", difficulty: "Medium" },
  { id: "d13", text: "Should billionaires exist?",  category: "Debate", difficulty: "Medium" },
  { id: "d14", text: "Is it possible to have a truly unbiased news source?", category: "Debate", difficulty: "Medium" },
  { id: "d15", text: "Should college education be free for everyone?", category: "Debate", difficulty: "Medium" },
  { id: "d16", text: "Does art require suffering?", category: "Debate", difficulty: "Medium" },
  { id: "d17", text: "Is it ethical to keep animals in zoos?", category: "Debate", difficulty: "Medium" },
  { id: "d18", text: "Should athletes be role models?", category: "Debate", difficulty: "Medium" },
  { id: "d19", text: "Is tradition more important than progress?", category: "Debate", difficulty: "Medium" },
  { id: "d20", text: "Should there be limits on free speech?", category: "Debate", difficulty: "Medium" },

  // ── Debate / Hard ──
  { id: "d21", text: "Is economic growth compatible with environmental sustainability?", category: "Debate", difficulty: "Hard" },
  { id: "d22", text: "Social media has done more good than harm.", category: "Debate", difficulty: "Hard" },
  { id: "d23", text: "Money can buy happiness. Defend this position.", category: "Debate", difficulty: "Hard" },
  { id: "d24", text: "University education is no longer worth the cost.", category: "Debate", difficulty: "Hard" },
  { id: "d25", text: "Should space exploration be funded by taxes or private companies?", category: "Debate", difficulty: "Hard" },
  { id: "d26", text: "Is democracy the best form of government?", category: "Debate", difficulty: "Hard" },
  { id: "d27", text: "Do the ends justify the means?", category: "Debate", difficulty: "Hard" },
  { id: "d28", text: "Should we colonize Mars even if it harms the planet?", category: "Debate", difficulty: "Hard" },
  { id: "d29", text: "Is free will an illusion?", category: "Debate", difficulty: "Hard" },
  { id: "d30", text: "Can war ever be justified?", category: "Debate", difficulty: "Hard" },

  // ── Hot Takes / Easy ──
  { id: "h01", text: "Breakfast for dinner is objectively superior.", category: "Hot Takes", difficulty: "Easy" },
  { id: "h02", text: "Convince me that pineapple belongs on pizza.", category: "Hot Takes", difficulty: "Easy" },
  { id: "h03", text: "The movie is always better than the book.", category: "Hot Takes", difficulty: "Easy" },
  { id: "h04", text: "Coffee is overrated.", category: "Hot Takes", difficulty: "Easy" },
  { id: "h05", text: "Mondays are actually the best day of the week.", category: "Hot Takes", difficulty: "Easy" },
  { id: "h06", text: "You do not need a college degree to be successful.", category: "Hot Takes", difficulty: "Easy" },
  { id: "h07", text: "Hot dogs are sandwiches.", category: "Hot Takes", difficulty: "Easy" },
  { id: "h08", text: "Winter is the best season for productivity.", category: "Hot Takes", difficulty: "Easy" },
  { id: "h09", text: "Naps should be mandatory at work.", category: "Hot Takes", difficulty: "Easy" },
  { id: "h10", text: "We should abolish daylight saving time.", category: "Hot Takes", difficulty: "Easy" },

  // ── Hot Takes / Medium ──
  { id: "h11", text: "Remote work is making people worse communicators.", category: "Hot Takes", difficulty: "Medium" },
  { id: "h12", text: "What is the most overrated city in the world?", category: "Hot Takes", difficulty: "Medium" },
  { id: "h13", text: "Most self-help books are a waste of time.", category: "Hot Takes", difficulty: "Medium" },
  { id: "h14", text: "The best music was made before the year 2000.", category: "Hot Takes", difficulty: "Medium" },
  { id: "h15", text: "Networking is just a fancy word for using people.", category: "Hot Takes", difficulty: "Medium" },
  { id: "h16", text: "Grades do not reflect intelligence.", category: "Hot Takes", difficulty: "Medium" },
  { id: "h17", text: "Side hustles are ruining hobbies.", category: "Hot Takes", difficulty: "Medium" },
  { id: "h18", text: "Most meetings could be emails.", category: "Hot Takes", difficulty: "Medium" },
  { id: "h19", text: "We romanticize the past too much.", category: "Hot Takes", difficulty: "Medium" },
  { id: "h20", text: "Multitasking is a myth.", category: "Hot Takes", difficulty: "Medium" },

  // ── Hot Takes / Hard ──
  { id: "h21", text: "The concept of work-life balance is a corporate lie.", category: "Hot Takes", difficulty: "Hard" },
  { id: "h22", text: "Meritocracy is the biggest myth of our generation.", category: "Hot Takes", difficulty: "Hard" },
  { id: "h23", text: "Social media influencers are the new televangelists.", category: "Hot Takes", difficulty: "Hard" },
  { id: "h24", text: "Most innovation is actually just repackaging old ideas.", category: "Hot Takes", difficulty: "Hard" },
  { id: "h25", text: "Hustle culture is just capitalism disguised as self-improvement.", category: "Hot Takes", difficulty: "Hard" },
  { id: "h26", text: "Nostalgia is a form of denial.", category: "Hot Takes", difficulty: "Hard" },
  { id: "h27", text: "We are less connected than ever despite technology.", category: "Hot Takes", difficulty: "Hard" },
  { id: "h28", text: "The pursuit of happiness is making people miserable.", category: "Hot Takes", difficulty: "Hard" },
  { id: "h29", text: "Democracy only works when the population is educated.", category: "Hot Takes", difficulty: "Hard" },
  { id: "h30", text: "Charity is often more about the giver than the receiver.", category: "Hot Takes", difficulty: "Hard" },

  // ── Extra variety topics ──
  { id: "x01", text: "What would the world look like without the internet?", category: "Technology", difficulty: "Medium" },
  { id: "x02", text: "Should parents monitor their children's online activity?",  category: "Society", difficulty: "Medium" },
  { id: "x03", text: "Is creativity a skill or a talent?", category: "General", difficulty: "Medium" },
  { id: "x04", text: "Would you trust an AI to make medical decisions for you?", category: "Technology", difficulty: "Hard" },
  { id: "x05", text: "Should companies be required to disclose their environmental impact?", category: "Business", difficulty: "Hard" },
  { id: "x06", text: "What would a perfect city look like?", category: "Society", difficulty: "Medium" },
  { id: "x07", text: "Is the customer always right?", category: "Business", difficulty: "Easy" },
  { id: "x08", text: "Explain why laughter is important.", category: "General", difficulty: "Easy" },
  { id: "x09", text: "If you could eliminate one invention, what would it be?", category: "Fun", difficulty: "Medium" },
  { id: "x10", text: "Is perfection achievable or just an illusion?", category: "Debate", difficulty: "Hard" },
  { id: "x11", text: "Should we fear artificial intelligence?", category: "Technology", difficulty: "Hard" },
  { id: "x12", text: "Is loyalty overvalued?", category: "General", difficulty: "Hard" },
  { id: "x13", text: "What is the purpose of art?", category: "Debate", difficulty: "Medium" },
  { id: "x14", text: "Should the rich pay significantly more taxes?", category: "Society", difficulty: "Hard" },
  { id: "x15", text: "Is it more important to be liked or respected?", category: "General", difficulty: "Medium" },
  { id: "x16", text: "Would you rather know how you die or when you die?", category: "Fun", difficulty: "Easy" },
  { id: "x17", text: "Is it better to have loved and lost than never to have loved at all?", category: "Debate", difficulty: "Medium" },
  { id: "x18", text: "Should every job require public speaking skills?", category: "Business", difficulty: "Medium" },
  { id: "x19", text: "What is the most important invention in human history?", category: "Technology", difficulty: "Medium" },
  { id: "x20", text: "If you could ask the world one question, what would it be?", category: "Fun", difficulty: "Easy" },
  { id: "x21", text: "Is it okay to lie to protect someone's feelings?", category: "General", difficulty: "Medium" },
  { id: "x22", text: "Should we bring back extinct species using cloning?", category: "Technology", difficulty: "Hard" },
  { id: "x23", text: "What is the role of failure in innovation?", category: "Business", difficulty: "Medium" },
  { id: "x24", text: "Is there such a thing as too much freedom?", category: "Society", difficulty: "Hard" },
  { id: "x25", text: "Argue for or against mandatory military service.", category: "Debate", difficulty: "Hard" },
  { id: "x26", text: "What would you do if you were invisible for a day?", category: "Fun", difficulty: "Easy" },
  { id: "x27", text: "Is it better to be a big fish in a small pond or a small fish in a big pond?", category: "General", difficulty: "Medium" },
  { id: "x28", text: "Should we prioritize exploring the ocean over space?", category: "Technology", difficulty: "Medium" },
  { id: "x29", text: "Is competition healthy or harmful for children?", category: "Society", difficulty: "Medium" },
  { id: "x30", text: "Defend the worst movie you have ever seen.", category: "Fun", difficulty: "Hard" },
  { id: "x31", text: "What does courage look like in everyday life?", category: "General", difficulty: "Easy" },
  { id: "x32", text: "Should robots have rights?", category: "Technology", difficulty: "Hard" },
  { id: "x33", text: "Is luck more important than hard work?", category: "Debate", difficulty: "Medium" },
  { id: "x34", text: "What would you change about the internet?", category: "Technology", difficulty: "Easy" },
  { id: "x35", text: "If you could live in any era of history, which would you choose?", category: "Fun", difficulty: "Easy" },
  { id: "x36", text: "Should we ban private cars in city centers?", category: "Society", difficulty: "Medium" },
  { id: "x37", text: "Is minimalism a lifestyle or a trend?", category: "General", difficulty: "Medium" },
  { id: "x38", text: "What makes someone an expert?", category: "Business", difficulty: "Medium" },
  { id: "x39", text: "Is social media making us more narcissistic?", category: "Hot Takes", difficulty: "Medium" },
  { id: "x40", text: "Should we teach financial literacy in schools?", category: "Society", difficulty: "Easy" },
  { id: "x41", text: "What is the meaning of home?", category: "General", difficulty: "Easy" },
  { id: "x42", text: "Should people be required to vote?", category: "Debate", difficulty: "Medium" },
  { id: "x43", text: "Would you give up your phone for a month for ten thousand dollars?", category: "Fun", difficulty: "Easy" },
  { id: "x44", text: "Is empathy a weakness or a strength in leadership?", category: "Business", difficulty: "Hard" },
  { id: "x45", text: "Does history repeat itself?", category: "Society", difficulty: "Hard" },
  { id: "x46", text: "What is one thing the world needs less of?", category: "General", difficulty: "Easy" },
  { id: "x47", text: "Should we celebrate Columbus Day?", category: "Debate", difficulty: "Hard" },
  { id: "x48", text: "Is it ethical to use animals for testing?", category: "Society", difficulty: "Hard" },
  { id: "x49", text: "Are first impressions reliable?", category: "General", difficulty: "Medium" },
  { id: "x50", text: "Should schools replace textbooks with tablets?", category: "Technology", difficulty: "Easy" },
  { id: "x51", text: "What would you tell your younger self?", category: "General", difficulty: "Easy" },
  { id: "x52", text: "Is ambition more important than talent?", category: "Business", difficulty: "Medium" },
  { id: "x53", text: "Would you live on another planet?", category: "Fun", difficulty: "Easy" },
  { id: "x54", text: "Should the internet be censored?", category: "Debate", difficulty: "Hard" },
  { id: "x55", text: "What is the biggest lie society tells us?", category: "Hot Takes", difficulty: "Hard" },
  { id: "x56", text: "Is patience still a virtue in the age of instant gratification?", category: "General", difficulty: "Hard" },
  { id: "x57", text: "What makes a great public speaker?", category: "Business", difficulty: "Easy" },
  { id: "x58", text: "Should we care about what future historians think of us?", category: "Society", difficulty: "Hard" },
  { id: "x59", text: "Design a new social media platform. What makes it different?", category: "Technology", difficulty: "Medium" },
  { id: "x60", text: "Is ignorance really bliss?", category: "Debate", difficulty: "Medium" },
];

export default topics;
