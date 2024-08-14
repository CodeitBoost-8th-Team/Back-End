import express from 'express';
import { PrismaClient } from '@prisma/client';
import postRouter from './routes/postRoutes.js';
import groupRouter from './routes/groupRoutes.js'; // 그룹 라우트 추가
import imageRouter from './routes/image.js'; // 이미지 라우트 추가
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const prisma = new PrismaClient();

app.use(express.json());

// 정적 파일 서비스 설정
app.use('/uploads', express.static('uploads'));


// 라우트 설정
app.use('/posts', postRouter);
app.use('/groups', groupRouter); // 그룹 라우트 사용
app.use('/api', imageRouter); // 이미지 라우트 사용

// bigInt 처리 미들웨어 추가
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
    try{
        const newGroup = await prisma.group.create({
            data: {
                name: 'Sample Grouphahaha',
                groupPassword: 'password',
                introduction: 'Nice to meet you guys.',
            },
        });

        const allGroups = await prisma.group.findMany();

        // JSON.stringify에서 BigInt를 처리
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({newGroup, allGroups}, (key, value) => 
            typeof value === 'bigint' ? value.toString() : value
        ));

    } catch(e){
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