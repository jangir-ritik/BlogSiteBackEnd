require('dotenv').config();

const express = require("express")
const mongoose = require('mongoose')
const User = require('./models/User')
const cors = require('cors')
const app = express();
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const multer = require('multer')
const uploadMiddleware = multer({ dest: 'uploads' })
const fs = require('fs')
const Post = require('./models/Post')
const unorm = require('unorm');

app.use(cors({ credentials: true, origin: 'http://localhost:3000' }))
app.use(express.json())
app.use(cookieParser())
app.use('/uploads', express.static(__dirname + '/uploads'))

const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

const salt = bcrypt.genSaltSync(10);
const secret = JWT_SECRET

console.log('connecting to the db...')
mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('db connected.')

        app.listen(PORT)
        console.log('listening to port 4000')
    })
    .catch(err => console.error('error connecting to the db:', err));

app.post('/register', async (req, res) => {
    const { username, password } = req.body
    try {
        const userDoc = await User.create({ username, password: bcrypt.hashSync(password, salt) })
        res.status(200).json(userDoc)
    } catch (error) {
        console.error('error in /register:', error);
        res.status(400).json({ error: error.message });
    }
})

app.post('/login', async (req, res) => {
    const { username, password } = req.body
    try {
        const userDoc = await User.findOne({ username })
        if (!userDoc) throw new Error('User not found');
        const passOk = bcrypt.compareSync(password, userDoc.password)
        if (passOk) {
            //     res.json('Login successful')
            jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
                if (err) {
                    console.error('error in /login (jwt.sign):', err);
                    res.status(500).json({ error: 'Internal server error' });
                } else {
                    res.cookie('token', token, {
                        sameSite: 'none',
                        secure: true
                    }).json({
                        id: userDoc._id,
                        username,
                    });
                }
            })
        } else {
            res.status(400).json('wrong credentials')
        }
    }
    catch (error) {
        console.error('error in /login:', error);
        res.status(400).json({ error: error.message });
    }
}
)

app.get('/profile', (req, res) => {
    const { token } = req.cookies;
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) {
            console.error('error in /profile (jwt.verify):', err);
            res.status(400).json({ error: 'Invalid token' });
        } else {
            res.json(info);
        }
    })
})

app.post('/logout', (req, res) => {
    res.cookie('token', '').json('ok');
})

app.post('/post', uploadMiddleware.single('files'), async (req, res) => {
    const { originalname, path } = req.file;
    const parts = originalname.split('.')
    const ext = parts[parts.length - 1]
    const normalizedPath = unorm.nfc(path);
    const newPath = `${normalizedPath}.${ext}`;
    fs.renameSync(path, newPath);

    const { token } = req.cookies

    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;

        const { title, content, summary } = req.body;
        const postDoc = await Post.create({
            title, summary, content, cover: newPath, author: info.id,
        })

        res.json(postDoc)
    })
})

app.get('/post', async (req, res) => {
    res.json(await Post.find()
        .populate('author', ['username'])
        .sort({ createdAt: -1 })
        .limit(20))
})

app.get('/post/:id', async (req, res) => {
    const postDetail = await Post.findOne({ '_id': req.params.id }).populate('author', ['username'])
    res.json(postDetail)
})
