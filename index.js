import pg from "pg";
import axios from "axios";
import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";

const app = express();
const port = 3000;
dotenv.config();

const db = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});
// db.connect();

app.set("view engine", "ejs");
app.set("views", "./views");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/books", async (req, res) => {
    try {
        const result = await db.query(
            `SELECT b.id, b.title, b.author, b.publish_date, b.cover_url, b.notes, i.isbn
            FROM books b
            LEFT JOIN isbns i ON b.id = i.book_id
            ORDER BY b.title ASC`
        );

        res.render("books", { books: result.rows });
    } catch (err) {
        console.error("Error fetching books: ", err);
        res.status(500).send("Error loading books");
    }
});

app.post("/books", async (req, res) => {
    const {title, author, publish_date, cover_url, notes} = req.body;

    const finalCoverUrl = cover_url && cover_url.trim() !== ""
        ? cover_url
        : "/assets/no_cover_available.png";

    try {
        await db.query(
            "INSERT INTO books (title, author, publish_date, cover_url, notes) VALUES ($1, $2, $3, $4, $5)",
            [title, author, publish_date, finalCoverUrl, notes]
        );

      res.redirect("/books");
    } catch (err) {
        console.log("Error adding book: ", err);
        res.status(500).send("Error adding book");
    }
});

app.get("/book/:isbn", async (req, res) => {
    const { isbn } = req.params;

    try {
        const existingBook = await db.query(
            `SELECT b.id, b.title, b.author, b.publish_date, b.cover_url, b.notes
            FROM books b
            JOIN isbns i ON b.id = i.book_id
            WHERE i.isbn = $1`,
            [isbn]
        );

        if (existingBook.rows.length > 0) {
            const book = existingBook.rows[0];
            const coverUrl = book.cover_url || `/assets/no_cover_available.png`;
            
            return res.render("index", {
                title: book.title,
                author: book.author,
                publishDate: book.publish_date,
                coverUrl,
                notes: book.notes
            });
        }

        console.log("Fetching from Open Library:", `https://openlibrary.org/isbn/${isbn}.json`);

        const bookRes = await axios.get(`https://openlibrary.org/isbn/${isbn}.json`);
        const bookData = bookRes.data;

        let authorName = "Unknown author";
        if (bookData.authors && bookData.authors.length > 0) {
            const authorKey = bookData.authors[0].key;
            const authorRes = await axios.get(`https://openlibrary.org${authorKey}.json`);
            authorName = authorRes.data.name;
        }
        
        const coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
        
        const insertResult = await db.query(
            "INSERT INTO books (title, author, publish_date, cover_url) VALUES ($1, $2, $3, $4) RETURNING id",
            [bookData.title, authorName, bookData.publish_date, coverUrl]
        );

        const bookId = insertResult.rows[0].id;

        await db.query(
            "INSERT INTO isbns (isbn, book_id) VALUES ($1, $2)",
            [isbn, bookId]
        );

        console.log("Inserted book with ID:", bookId);

        res.render("index", {
            title: bookData.title,
            author: authorName,
            publishDate: bookData.publish_date,
            coverUrl,
            notes: null
        });
    } catch (err){
        console.log("Database error: ", err);
        res.status(500).send("Error fetching book details");
    }
});

app.get("/books/:id/edit", async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(
            `SELECT b.id, b.title, b.author, b.publish_date, b.notes, b.cover_url, i.isbn
            FROM books b
            LEFT JOIN isbns i ON b.id = i.book_id
            WHERE b.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).send("Book not found");
        }

        res.render("edit-book", { book: result.rows[0] });
    } catch (err) {
        console.log("Error fetching book fo edit: ", err);
        res.status(500).send("Error loading edit form");
    }
});

app.post("/books/:id/edit", async (req, res) => {
    const { id } = req.params;
    const { title, author, publish_date, notes, cover_url, isbn } = req.body;

    try {
        await db.query(
            "UPDATE books SET title = $1, author = $2, publish_date = $3, notes = $4, cover_url = $5 WHERE id = $6",
            [title, author, publish_date, notes, cover_url, id]
        );

        if (isbn && isbn.trim() !== "") {
            const isbnResult = await db.query(
                "SELECT * FROM isbns WHERE book_id = $1",
                [id]
            );

            const newCoverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;

            if (isbnResult.rows.length > 0) {
                await db.query(
                    "UPDATE isbns SET isbn = $1 WHERE book_id = $2",
                    [isbn, id]
                );
            } else {
                await db.query(
                    "INSERT INTO isbns (isbn, book_id) VALUES ($1, $2)",
                    [isbn, id]
                );
            }

            await db.query(
                "UPDATE books SET cover_url = $1 WHERE id = $2",
                [newCoverUrl, id]
            );
        } else {
            await db.query("DELETE FROM isbns WHERE book_id = $1", [id]);

            await db.query(
                "UPDATE books SET cover_url = $1 WHERE id = $2",
                ["/assets/no_cover_available.png", id]
            );
        }

        res.redirect("/books");
    } catch (err) {
        console.log("Error updating book: ", err);
        res.status(500).send("Error updating book");
    }
});

app.get("/books/new", (req, res) => {
    res.render("new-book");
})

app.post("/books/:id/delete", async (req, res) => {
    const { id } = req.params;

    try {
        await db.query("DELETE FROM isbns WHERE book_id = $1", [id]);
        await db.query("DELETE FROM books WHERE id = $1", [id]);
        res.redirect("/books");
    } catch (err) {
        console.log("Error deleting book: ", err);
        res.status(500).send("Error deleting book");
    }
})


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
