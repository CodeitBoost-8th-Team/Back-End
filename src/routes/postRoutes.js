import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();
const prisma = new PrismaClient();

// bigInt 처리 미들웨어 추가
router.use((req, res, next) => {
    res.json = (data) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(data, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));
    };
    next();
});

// 게시글 수정
router.put('/:postId', asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const { nickname, title, content, postPassword, imageUrl, tags, location, moment, isPublic } = req.body;

    // 게시글 조회
    const post = await prisma.post.findUnique({
        where: { postId },
        include: { postTags: { include: { tag: true } } } // 기존 태그 포함
    });

    if (!post) {
        return res.status(404).json({ message: '존재하지 않습니다' });
    }

    // 비밀번호 확인
    if (post.postPassword !== postPassword) {
        return res.status(401).json({ message: '비밀번호가 틀렸습니다' });
    }

    // 태그 처리
    const updatedTags = tags.map(tag => ({
        tag: {
            connectOrCreate: {
                where: { content: tag },
                create: { content: tag },
            },
        }
    }));

    // 게시글 업데이트
    const updatedPost = await prisma.post.update({
        where: { postId },
        data: {
            nickname,
            title,
            content,
            imageUrl,
            location,
            moment: moment ? new Date(moment) : null,
            isPublic: Boolean(isPublic),
            postTags: {
                deleteMany: {}, // 기존 태그 모두 삭제
                create: updatedTags // 새로운 태그 추가
            },
        },
        include: {
            postTags: {
                include: {
                    tag: true
                }
            }
        }
    });

    res.status(200).json({
        id: updatedPost.postId,
        groupId: updatedPost.groupId,
        nickname: updatedPost.nickname,
        title: updatedPost.title,
        content: updatedPost.content,
        imageUrl: updatedPost.imageUrl,
        tags: updatedPost.postTags.map(pt => pt.tag.content),
        location: updatedPost.location,
        moment: updatedPost.moment,
        isPublic: updatedPost.isPublic,
        likeCount: updatedPost.likeCount,
        commentCount: updatedPost.commentCount,
        createdAt: updatedPost.createdAt,
        updatedAt: updatedPost.updatedAt,
    });
}));

// 게시글 삭제
router.delete('/:postId', asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const { postPassword } = req.body;

    // 게시글 조회
    const post = await prisma.post.findUnique({
        where: { postId },
    });

    if (!post) {
        return res.status(404).json({ message: '존재하지 않습니다' });
    }

    // 비밀번호 확인
    if (post.postPassword !== postPassword) {
        return res.status(401).json({ message: '비밀번호가 틀렸습니다' });
    }

    // 게시글 삭제
    await prisma.post.delete({
        where: { postId },
    });

    res.status(200).json({ message: '게시글 삭제 성공' });
}));


// 게시글 상세 정보 조회
router.get('/:postId', asyncHandler(async (req, res) => {
    const { postId } = req.params;

    // 게시글 조회
    const post = await prisma.post.findUnique({
        where: { postId },
        include: {
            postTags: {
                include: {
                    tag: true,
                },
            },
        },
    });

    if (!post) {
        return res.status(404).json({ message: '존재하지 않습니다' });
    }

    // 응답 데이터 구성
    const responseData = {
        id: post.postId,
        groupId: post.groupId,
        nickname: post.nickname,
        title: post.title,
        content: post.content,
        imageUrl: post.imageUrl,
        tags: post.postTags.map(pt => pt.tag.content),
        location: post.location,
        moment: post.moment,
        isPublic: post.isPublic,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
    };

    res.status(200).json(responseData);
}));

// 게시글 조회 권한 확인 및 비공개 그룹의 게시글 상세 조회
router.post('/:postId/private', asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const { groupPassword } = req.body;

    // 게시글 조회
    const post = await prisma.post.findUnique({
        where: { postId },
        include: {
            group: true, // 그룹 정보 포함
            postTags: {
                include: {
                    tag: true,
                },
            },
        },
    });

    if (!post) {
        return res.status(404).json({ message: '존재하지 않습니다' });
    }

    // 비공개 그룹인지 확인
    if (!post.group.isPublic) {
        // 그룹 비밀번호 확인
        if (post.group.groupPassword !== groupPassword) {
            return res.status(401).json({ message: '비밀번호가 틀렸습니다' });
        }
    }

    // 응답 데이터 구성
    const responseData = {
        id: post.postId,
        groupId: post.groupId,
        nickname: post.nickname,
        title: post.title,
        content: post.content,
        imageUrl: post.imageUrl,
        tags: post.postTags.map(pt => pt.tag.content),
        location: post.location,
        moment: post.moment,
        isPublic: post.isPublic,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
    };

    res.status(200).json(responseData);
}));

// 게시글 공감하기
router.post('/:postId/like', asyncHandler(async (req, res) => {
    const { postId } = req.params;

    // 게시글 조회
    const post = await prisma.post.findUnique({
        where: { postId },
    });

    if (!post) {
        return res.status(404).json({ message: '존재하지 않습니다' });
    }

    // 공감 수 증가
    await prisma.post.update({
        where: { postId },
        data: { likeCount: { increment: 1 } },
    });

    res.status(200).json({ message: '게시글 공감하기 성공' });
}));

// 게시글 공개 여부 확인
router.get('/:postId/is-public', asyncHandler(async (req, res) => {
    const { postId } = req.params;

    // 게시글 조회
    const post = await prisma.post.findUnique({
        where: { postId },
        select: { postId: true, isPublic: true },
    });

    if (!post) {
        return res.status(404).json({ message: '존재하지 않습니다' });
    }

    // 응답 데이터 구성
    const responseData = {
        id: post.postId,
        isPublic: post.isPublic,
    };

    res.status(200).json(responseData);
}));

export default router;
