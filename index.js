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

app.get("/book/:isbn", async (req, res) => {
    const { isbn } = req.params;

    try {
        const bookRes = await axios.get(`https://openlibrary.org/isbn/${isbn}.json`);
        const bookData = bookRes.data;

        let authorName = "Unknown author";
        if (bookData.authors && bookData.authors.length > 0) {
            const authorKey = bookData.authors[0].key;
            const authorRes = await axios.get(`https://openlibrary.org${authorKey}.json`);
            authorName = authorRes.data.name;
        }
        
        const coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
        
        const result = await db.query(
            "INSERT INTO books (title, author, publish_date) VALUES ($1, $2, $3) RETURNING id",
            [bookData.title, authorName, bookData.publish_date]
        );

        console.log("Inserted book with ID:", result.rows[0].id);

        res.render("index", {
            title: bookData.title,
            author: authorName,
            publishDate: bookData.publish_date,
            coverUrl
        });
    } catch (err){
        console.log(err.message);
        res.status(500).send("Error fetching book details");
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
