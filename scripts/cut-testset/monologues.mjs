/**
 * Six short talking-head scripts, invented for the test set. Each line is one
 * sentence a creator would deliver. `alt` is an earlier, clumsier wording of
 * the same line, for a retake that changes the words. `trap` marks a line that
 * repeats on purpose for emphasis and must survive the cut whole.
 */
export const MONOLOGUES = {
  week: [
    { text: "Stop planning your whole week on Sunday night." },
    {
      text: "By Wednesday the plan is already wrong, and you feel behind for no reason.",
      alt: "By Wednesday your plan is kind of wrong and then you feel bad about it.",
    },
    { text: "Plan one day at a time, the evening before." },
    {
      text: "Write down the three things that would make tomorrow a good day.",
    },
    { text: "Three, not ten. Three is the whole trick.", trap: true },
    {
      text: "Then put the hardest one first, before you open your phone.",
      alt: "And then you do the hard one first, before you look at your phone.",
    },
    { text: "I have done this for 90 days and I have missed four." },
    { text: "Try it tonight and tell me how tomorrow goes." },
  ],
  squat: [
    { text: "Your knees are allowed to go past your toes when you squat." },
    {
      text: "That rule came from one study in 1978, and it has been misread ever since.",
      alt: "That rule is from a really old study and people got it wrong.",
    },
    {
      text: "What matters is that your heels stay down and your back stays straight.",
    },
    { text: "If your heels lift, put a small plate under them." },
    { text: "It works. It really works.", trap: true },
    {
      text: "Start with just your body weight and go slow on the way down.",
      alt: "Start with no weight and take the way down slowly.",
    },
    {
      text: "Three sets of eight, twice a week, is enough to see a change in a month.",
    },
    { text: "Save this for your next leg day." },
  ],
  launch: [
    { text: "I launched my app to nobody, and it was the best thing I did." },
    {
      text: "For six weeks I had 12 users, and I knew every one of them by name.",
      alt: "For about six weeks I only had 12 users and I knew all of them.",
    },
    { text: "I asked each of them what almost made them quit." },
    { text: "Nine of them said the same thing: the sign up was too long." },
    { text: "So I cut it. I cut it from seven steps to two.", trap: true },
    {
      text: "The next month, 40 percent more people finished signing up.",
      alt: "The month after that, sign ups went up by 40 percent.",
    },
    {
      text: "You do not need a big launch. You need a small group that tells you the truth.",
    },
    { text: "Follow along if you are building something too." },
  ],
  pasta: [
    { text: "You are probably salting your pasta water wrong." },
    {
      text: "A pinch does nothing, because most of it goes down the drain.",
      alt: "A little pinch of salt doesn't do anything because it just goes down the drain.",
    },
    { text: "Use one tablespoon for every four cups of water." },
    { text: "Add it after the water boils, not before." },
    { text: "Taste the water. Yes, taste the water.", trap: true },
    {
      text: "It should taste like a light soup, not like the sea.",
      alt: "It should be like a mild soup and not like sea water.",
    },
    { text: "Then save half a cup of that water for your sauce." },
    {
      text: "That is the difference between dry pasta and the kind you get at a restaurant.",
    },
  ],
  savings: [
    { text: "The easiest way to save money is to never see it." },
    {
      text: "Set up a transfer for the morning your paycheck arrives.",
      alt: "Make a transfer that happens the same morning you get paid.",
    },
    { text: "Start with 50 dollars, even if that feels too small to matter." },
    {
      text: "In a year that is 1,200 dollars you did not have to think about.",
    },
    { text: "Small is fine. Small is the point.", trap: true },
    {
      text: "Raise it by 10 dollars every time you get a raise.",
      alt: "Then bump it up 10 dollars whenever your pay goes up.",
    },
    { text: "Put it in an account that takes two days to move money out of." },
    { text: "Send this to the friend who says they are bad with money." },
  ],
  spanish: [
    {
      text: "I learned more Spanish in 30 days of talking than in two years of apps.",
    },
    {
      text: "Apps teach you to recognize words, not to say them.",
      alt: "The apps kind of teach you to see words but not really to speak.",
    },
    { text: "So I booked a 25 minute call with a tutor every single morning." },
    {
      text: "The first week was painful, and I said the same five sentences every day.",
    },
    { text: "That is normal. That is completely normal.", trap: true },
    {
      text: "By week three I could order food, ask for directions and make a joke.",
      alt: "By the third week I could order, ask where things are and joke around a bit.",
    },
    { text: "It cost me about 8 dollars a call." },
    {
      text: "If you are stuck at the same level, stop tapping and start talking.",
    },
  ],
};
