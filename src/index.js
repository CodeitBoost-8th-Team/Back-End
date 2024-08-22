import express from 'express';
import { PrismaClient } from '@prisma/client';
import postRouter from './routes/postRoutes.js';
import groupRouter from './routes/groupRoutes.js'; // 그룹 라우트 추가
import imageRouter from './routes/image.js'; // 이미지 라우트 추가
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const corsOptions = {
  origin: ['http://127.0.0.1:3000'],
};
app.use(cors(corsOptions));
app.use(express.json());
const port = process.env.PORT || 5000;
const prisma = new PrismaClient();

app.use(express.json());  // JSON 형식의 요청을 처리하는 미들웨어

// 정적 파일 서비스 설정
app.use('/uploads', express.static('uploads'));

// 라우트 설정
app.use('/api/comments', postRouter);       // Comment 관련 경로
app.use('/api/posts', postRouter);       // Post 관련 경로
app.use('/api/groups', groupRouter);     // Group 관련 경로
app.use('/api/image', imageRouter);      // Image 관련 경로

// BigInt 처리 미들웨어 추가
app.use((req, res, next) => {
    res.json = (data) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(data, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));
    };
    next();
});

// 기본 라우트
app.get('/', (req, res) => {
    res.send('Hello World!');
});

// DB 테스트 라우트
app.get('/test-db', async (req, res) => {
    try {
        const newGroup = await prisma.group.create({
            data: {
                name: 'Sample Grouphahaha',
                groupPassword: 'password',
                introduction: 'Nice to meet you guys.',
            },
        });

        const allGroups = await prisma.group.findMany();

        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({newGroup, allGroups}, (key, value) => 
            typeof value === 'bigint' ? value.toString() : value
        ));

    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// 서버 시작
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// 서버 종료 시 Prisma 클라이언트 종료
process.on('SIGINT', async () => {
    await prisma.$disconnect();
    process.exit();
});
