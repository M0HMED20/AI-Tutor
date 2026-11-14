/* ===========================================================
   DEMO TUTOR (mock data) – replace with your real backend
   Loaded BEFORE main.js. Uses `state` from main.js at call time.
   =========================================================== */
const KB = {
  normalization: {
    title: 'Database Normalization',
    keywords: ['normaliz', '1nf', '2nf', '3nf', 'bcnf', 'anomal'],
    sources: [
      { id: 1, title: 'Database Systems – Lecture 5: Normalization', doc: 'Lecture slides', page: '12–15',
        snippet: 'Normalization organizes attributes into relations to reduce redundancy and avoid update, insert and delete anomalies.' },
      { id: 2, title: 'Database System Concepts – Chapter 7', doc: 'Textbook', page: '329',
        snippet: 'A relation is in 3NF if every non-key attribute depends on the key, the whole key, and nothing but the key.' },
    ],
    answers: {
      simple: `Normalization means **organizing your tables so each fact is stored only once** [1].

If a customer's address is copied into 50 order rows, changing it means fixing 50 places — and missing one creates wrong data. Splitting the data into separate tables avoids that [1].

You'll usually hear about three levels: **1NF, 2NF and 3NF**. Each one removes a bit more repetition [2].`,
      detailed: `**Database normalization** is the process of structuring relations to reduce redundancy and prevent update, insert and delete anomalies [1].

- **1NF** – every column holds atomic values, with no repeating groups [1].
- **2NF** – 1NF plus no *partial* dependency: every non-key column depends on the whole composite key [1].
- **3NF** – 2NF plus no *transitive* dependency: non-key columns depend on the key, the whole key, and nothing but the key [2].

The trade-off: more tables mean more joins, so read-heavy systems sometimes denormalize on purpose [1].`,
      steps: `Here is how to normalize a table, step by step:

1. **Check 1NF** – make every cell a single value; split lists like "Math, Physics" into separate rows [1].
2. **Find the key** – decide which column(s) uniquely identify a row [1].
3. **Apply 2NF** – move columns that depend on only part of a composite key into their own table [1].
4. **Apply 3NF** – move columns that depend on another non-key column (e.g. CustomerName → CustomerId) into their own table [2].
5. **Reconnect with foreign keys** so the data can be joined back together [1].`,
      analogy: `Think of a **phone contacts app** [1]. If you save "Mom" three times with three different numbers, you never know which one is right. Normalization is merging them into *one* contact card that everything else points to.

In a database, the contact card is a table and the pointer is a **foreign key**. 1NF, 2NF and 3NF are the rules that tell you when a card still holds information that belongs on a different card [2].`,
      exam: `**Exam focus – Normalization**

- **Goal:** reduce redundancy and anomalies (update, insert, delete) [1].
- **1NF:** atomic values · **2NF:** no partial dependency · **3NF:** no transitive dependency [1][2].
- **Common question:** given a table and its functional dependencies, find the highest normal form and decompose it.

**Common mistakes**
- Mixing up *partial* (2NF) and *transitive* (3NF) dependencies [2].
- Forgetting that 2NF only matters when the key is composite [1].`,
      socratic: `Let's work it out together instead of me giving the answer. 🧭

1. Imagine a table where a customer's phone number appears in 100 order rows. What happens if the number changes? [1]
2. What problem could appear if you update only 99 of those rows?
3. How could you store the phone number so it exists in *only one place*?

Try answering, and I'll guide you toward **1NF–3NF** from there [2]. Hint: think about splitting one table into two.`,
    },
    quiz: [
      { q: 'Which problem does normalization mainly try to reduce?', o: ['Slow network speed', 'Data redundancy and anomalies', 'Large file sizes on disk', 'Weak passwords'], a: 1,
        why: "Normalization removes repeated data so updates, inserts and deletes don't cause anomalies.", c: [1] },
      { q: 'A table is in 1NF when…', o: ['Every column holds atomic (single) values', 'It has no primary key', 'It has exactly two columns', 'All values are numbers'], a: 0,
        why: 'First normal form requires atomic values and no repeating groups.', c: [1] },
      { q: '2NF removes which kind of dependency?', o: ['Partial dependency on part of a composite key', 'Dependency on the whole key', 'Foreign key dependency', 'Transitive dependency only'], a: 0,
        why: 'Second normal form removes partial dependencies on a composite key.', c: [1] },
      { q: '"Every non-key attribute depends on the key, the whole key, and nothing but the key" describes:', o: ['1NF', '2NF', '3NF', 'Denormalization'], a: 2,
        why: 'This is the classic informal definition of third normal form.', c: [2] },
      { q: 'In an Orders table, CustomerName depends on CustomerId, not on OrderId. This violates:', o: ['3NF – a transitive dependency', '1NF', 'Referential integrity', 'Nothing — it is fine'], a: 0,
        why: 'OrderId → CustomerId → CustomerName is transitive. Move customer data to its own table.', c: [1, 2] },
    ],
  },

  indexes: {
    title: 'Database Indexes',
    keywords: ['index', 'indices', 'b-tree', 'clustered', 'table scan'],
    sources: [
      { id: 1, title: 'Database Systems – Lecture 8: Indexing', doc: 'Lecture slides', page: '7–11',
        snippet: 'An index is a separate sorted structure, usually a B-tree, that lets the engine find rows without scanning the whole table.' },
      { id: 2, title: 'SQL Server Docs – Clustered and nonclustered indexes', doc: 'Reference', page: '2',
        snippet: 'A clustered index defines the physical order of the rows, so a table can have only one. Nonclustered indexes store keys with row locators.' },
    ],
    answers: {
      simple: `An index is like the **index at the back of a book**: instead of reading every page, you jump straight to the right one [1].

Without an index, the database checks every row (a *table scan*). With one, it finds matching rows much faster [1]. The cost is extra storage and slightly slower writes [2].`,
      detailed: `An **index** is a separate sorted structure, usually a B-tree, that lets the engine locate rows without scanning the table [1].

- **Clustered index** – defines the physical order of the rows; only one per table [2].
- **Nonclustered index** – stores key values with pointers to the rows; you can have many [2].

**Trade-off:** every extra index uses storage and must be updated on INSERT, UPDATE and DELETE, so index the columns you filter, join and sort on — not everything [1][2].`,
      steps: `How to decide on an index:

1. **Find the slow query** and look at its WHERE, JOIN and ORDER BY columns [1].
2. **Check the execution plan** for table scans [1].
3. **Create a nonclustered index** on the filtered column(s) [2].
4. **Re-test** the query and compare timings [1].
5. **Watch the write cost** – drop indexes that are rarely used [2].`,
      analogy: `Imagine a **library**. Books arranged on the shelves by number are the *clustered index* — the data itself is in order [2]. The card catalog sorted by author is a *nonclustered index*: it doesn't hold the books, it just tells you where they are [2].

Both save you from walking every aisle, but someone has to keep the catalog updated whenever a book arrives [1].`,
      exam: `**Exam focus – Indexes**

- Purpose: speed up searches by avoiding full scans [1].
- **Clustered:** one per table, defines row order · **Nonclustered:** many, separate structure [2].
- Cost: storage + slower writes [1][2].

**Common mistakes**
- Saying a table can have several clustered indexes [2].
- Indexing every column "just in case" [1].`,
      socratic: `Let's think it through. 🧭

1. If a table has 10 million rows and you search for one email, how many rows might the database check without an index? [1]
2. What could make that faster — how do you find a word in a dictionary?
3. If you add that structure, what extra work happens when a new row is inserted? [2]

Share your answers and we'll connect them to clustered vs nonclustered indexes.`,
    },
    quiz: [
      { q: 'What does an index mainly speed up?', o: ['Reading rows that match a search condition', 'Deleting an entire table', 'Creating foreign keys', 'Backing up the database'], a: 0,
        why: 'Indexes let the engine find matching rows without scanning the whole table.', c: [1] },
      { q: 'How many clustered indexes can a table have?', o: ['One', 'Two', 'One per column', 'Unlimited'], a: 0,
        why: 'The clustered index defines the physical row order, so there can be only one.', c: [2] },
      { q: 'A downside of adding many indexes is…', o: ['Slower INSERT/UPDATE/DELETE and more storage', 'Queries stop working', 'Tables lose their primary keys', 'Nothing — they are free'], a: 0,
        why: 'Every index must be maintained on writes and takes space.', c: [1, 2] },
      { q: 'Which structure do most database indexes use?', o: ['B-tree', 'Stack', 'Linked list', 'Queue'], a: 0,
        why: 'Most engines implement indexes as B-trees.', c: [1] },
      { q: 'A query filters WHERE Email = @e on a huge Users table. Best first fix?', o: ['Add a nonclustered index on Email', 'Add a clustered index on every column', 'Delete old rows', 'Use SELECT *'], a: 0,
        why: 'A nonclustered index on the filtered column avoids a full table scan.', c: [1, 2] },
    ],
  },
};

function detectTopic(text) {
  const t = text.toLowerCase();
  return Object.keys(KB).find((k) => KB[k].keywords.some((w) => t.includes(w))) || null;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuiz(topicKey, count, difficulty) {
  const topic = KB[topicKey];
  const questions = shuffle(topic.quiz).slice(0, count).map((q) => {
    const order = shuffle(q.o.map((text, idx) => ({ text, idx })));
    return { ...q, o: order.map((x) => x.text), a: order.findIndex((x) => x.idx === q.a) };
  });
  return {
    type: 'quiz',
    title: `Quiz: ${topic.title}`,
    topicTitle: topic.title,
    difficulty,
    questions,
    citations: topic.sources,
  };
}

function mockTutor({ message, mode, quiz }) {
  const wantsQuiz = /\b(quiz|mcq|test me|practice questions|multiple choice)\b/i.test(message);
  const key = detectTopic(message) || (wantsQuiz ? state.lastTopic : null);

  if (key) state.lastTopic = key;

  if (wantsQuiz) {
    if (!key) {
      return { type: 'answer', text: 'Happy to make a quiz! Which topic should it cover? For this demo you can try **normalization** or **indexes**.' };
    }
    return buildQuiz(key, quiz.count, quiz.difficulty);
  }

  if (key) {
    return { type: 'answer', text: KB[key].answers[mode], citations: KB[key].sources };
  }

  if (/^(hi|hello|hey|salam|good (morning|evening))\b/i.test(message)) {
    return { type: 'answer', text: 'Hello! 👋 Ask me a question about your course, or say **"make a quiz on …"**. You can change how I explain things from the **Settings → Explanation mode** panel.' };
  }

  return {
    type: 'answer',
    text: "I couldn't find this in your course materials, so I won't guess. 🔎\n\nTry rephrasing, or ask about a topic from your lectures. (In this demo the topics available are **normalization** and **indexes**.)",
  };
}
