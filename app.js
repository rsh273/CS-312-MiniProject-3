const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const session =require("express-session");
require("dotenv").config();
const app = express();
const port = 3000;

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "BlogDB",
    password: process.env.DB_PASSWORD,
    port: 5432
});

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true}));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

// show signup page
app.get("/signup", (req, res) => {
    res.render("signup", {
        error: null
    });
});

// create a new user
app.post("/signup", async (req, res) => {
    const userId = req.body.user_id;
    const password = req.body.password;
    const name = req.body.name;

    try {
        const existingUser = await pool.query(
            "SELECT * FROM users WHERE user_id = $1",
            [userId]
        );

        if (existingUser.rows.length > 0) {
            return res.render("signup", {
                error: "That user ID is already taken. Please choose another one."
            });
        }

        await pool.query(
            "INSERT INTO users (user_id, password, name) VALUES ($1, $2, $3)",
            [userId, password, name]
        );

        res.redirect("/signin");

    } catch (error) {
        console.log(error);

        res.render("signup", {
            error: "There was a problem creating your account."
        });
    }
});

// show signin page
app.get("/signin", (req, res) => {
    res.render("signin", {
        error: null
    });
});

// sign in an existing user
app.post("/signin", async (req, res) => {
    const userId = req.body.user_id;
    const password = req.body.password;

    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE user_id = $1 AND password = $2",
            [userId, password]
        );

        if (result.rows.length === 0) {
            return res.render("signin", {
                error: "Incorrect user ID or password. Please try again."
            });
        }

        const user = result.rows[0];

        req.session.user = {
            user_id: user.user_id,
            name: user.name
        };

        res.redirect("/");

    } catch (error) {
        console.log(error);

        res.render("signin", {
            error: "There was a problem signing in."
        });
    }
});

//home page - Load post from PostgreSQL
app.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                blog_id AS id,
                creator_name AS name,
                creator_user_id,
                title,
                body AS blog,
                date_created AS date
            FROM blogs
            ORDER BY date_created DESC
        `);

        res.render("index", {
            posts: result.rows,
            currentUser: req.session.user || null
        });
    } catch (error) {
        console.log(error);
        res.send("There was a problem loading the blog posts.");
    }
});

// add a new blog post
app.post("/add-post", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/signin");
    }

    const title = req.body.title;
    const blog = req.body.blog;
    
    try {
        await pool.query(
            `INSERT INTO blogs
            (creator_name, creator_user_id, title, body, date_created)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)` ,
            [
                req.session.user.name,
                req.session.user.user_id,
                title,
                blog
            ]
        );

        res.redirect("/");
    } catch (error) {
        console.log(error);
        res.send("There was a problem creating the post.");
    }
});

// open the edit page
app.get("/edit/:id", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/signin");
    }

    const id = req.params.id;

    try {
        const result = await pool.query(
            `SELECT
                blog_id AS id,
                creator_user_id,
                title,
                body AS blog
            FROM blogs
            WHERE blog_id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.send("Post not found");
        }

        const post = result.rows[0];

        if (post.creator_user_id !== req.session.user.user_id) {
            return res.send("You can only edit your own posts.");
        }

        res.render("edit", {
            post: post
        });

    } catch (error) {
        console.log(error);
        res.send("There was a problem loading the post.");
    }
});

// update the post
app.post("/edit/:id", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/signin");
    }

    const id = req.params.id
    const title = req.body.title;
    const blog = req.body.blog;

    try {
        await pool.query(
            `UPDATE blogs
            SET title = $1, body = $2
            WHERE blog_id = $3
            AND creator_user_id = $4`,
            [
                title,
                blog,
                id,
                req.session.user.user_id
            ]
        );

        res.redirect("/");
    } catch (error) {
        console.log(error);
        res.send("There was a problem updating the post.");
    }
});

// delete a blog post
app.post("/delete/:id", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/signin");
    }

    const id = req.params.id;

    try {
        const result = await pool.query(
            `DELETE FROM blogs
            WHERE blog_id = $1
            AND creator_user_id = $2`,
            [
                id,
                req.session.user.user_id
            ]
        );

        if (result.rowCount === 0) {
            return res.send("You can only delete your own post.");
        }

        res.redirect("/");
    } catch (error) {
        console.log(error);
        res.send("There was a problem deleting the post.");
    }
});

app.listen(port, () => {
    console.log(`Blog app running on http://localhost:${port}`);
});
