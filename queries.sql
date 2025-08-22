CREATE TABLE books (
  id SERIAL PRIMARY KEY NOT NULL,
  title VARCHAR(255) NOT NULL,
  publish_date VARCHAR(40),
  author VARCHAR(255),
  cover_url TEXT,
  notes TEXT
);

CREATE TABLE isbns (
	id SERIAL PRIMARY KEY,
	isbn VARCHAR(13) UNIQUE NOT NULL,
	book_id INT REFERENCES books(id) ON DELETE CASCADE
);

-- Example
INSERT INTO books (title, author, publish_date)
VALUES ('Clean Code', 'Robert C. Martin', '2008-08-01')
RETURNING id;

INSERT INTO isbns (isbn, book_id)
VALUES 
('9780132350884', 1),   -- hardcover
('9780137081073', 1);   -- ebook
-- 