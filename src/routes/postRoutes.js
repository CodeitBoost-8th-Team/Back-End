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
    const { nickname, title, content, postPassword, imageUrl, tags, location, moment, isPublicPost } = req.body;

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
            isPublic: Boolean(isPublicPost),
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
        isPublicPost: updatedPost.isPublic,
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
        select: { postPassword: true, groupId: true}, // groupId를 함께 조회
    });

    if (!post) {
        return res.status(404).json({ message: '존재하지 않습니다' });
    }

    // 비밀번호 확인
    if (post.postPassword !== postPassword) {
        return res.status(401).json({ message: '비밀번호가 틀렸습니다' });
    }

    // 게시글과 연결된 데이터 삭제 먼저 해줘야 함
    await prisma.comment.deleteMany({ where: { postId } });
    await prisma.postTag.deleteMany({ where: { postId } });

    // 게시글 삭제
    await prisma.post.delete({
        where: { postId },
    });

    // 그룹의 postCount 감소
    await prisma.group.update({
        where: { groupId: post.groupId },
        data: {
            postCount: { decrement: 1 },
        },
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

    if(!post.isPublic){
        return res.status(401).json({message : "비공개 게시글은 다른 라우트에서 비밀번호 입력 후에 조회 가능합니다."});
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
        isPublicPost: post.isPublic,
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

    if(post.group.isPublic){
        return res.status(401).json({message: "이 라우트에서는 비공개 게시글만 조회할 수 있습니다."});
    }

    // 그룹 비밀번호 확인
    if (post.group.groupPassword !== groupPassword) {
        return res.status(401).json({ message: '비밀번호가 틀렸습니다' });
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
        isPublicPost: post.isPublic,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
    };

    res.status(200).json(responseData);
}));

// 공개그룹 게시글 공감하기
router.post('/:postId/like', asyncHandler(async (req, res) => {
    const { postId } = req.params;

    // 게시글 조회
    const post = await prisma.post.findUnique({
        where: { postId },
    });

    if (!post) {
        return res.status(404).json({ message: '존재하지 않습니다' });
    }

    if(!post.isPublic){
        return res.status(401).json({message : "비공개 게시글은 다른 라우트에서 비밀번호 입력 후에 조회 가능합니다."});
    }

    // 공감 수 증가
    await prisma.post.update({
        where: { postId },
        data: { likeCount: { increment: 1 } },
    });

    res.status(200).json({ message: '게시글 공감하기 성공' });
}));

// 비공개그룹 게시글 공감하기
router.post('/:postId/like/private', asyncHandler(async (req, res) => {
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

    if(post.group.isPublic){
        return res.status(401).json({message: "이 라우트에서는 비공개 포스트만 공감할 수 있습니다."});
    }

    // 그룹 비밀번호 확인
    if (post.group.groupPassword !== groupPassword) {
        return res.status(401).json({ message: '비밀번호가 틀렸습니다' });
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
        isPublicPost: post.isPublic,
    };

    res.status(200).json(responseData);
}));


// 댓글 등록
router.post('/:postId/comments', asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const { nickname, content, commentPassword } = req.body;
  
    const post = await prisma.post.findUnique({
        where: { postId },
    });
  
    if (!post) {
        return res.status(404).json({ message: '추억(포스트)을 찾을 수 없습니다.' });
    }
  
    const newComment = await prisma.comment.create({
        data: {
            postId,
            nickname,
            content,
            commentPassword,
        },
    });
  
    // 댓글 등록 후, 포스트의 commentCount를 증가시킵니다.
    await prisma.post.update({
      where: { postId },
      data: {
          commentCount: { increment: 1 }, // postCount를 1 증가시킵니다.
      },
    });
  
    res.status(200).json({ // postId는 안 줘도 됨, 정보로 받은게 postId임
        id: newComment.commentId,
        nickname: newComment.nickname,
        content: newComment.content,
        createdAt: newComment.createdAt,
        updatedAt: newComment.updatedAt,
    });
  }));


  // 댓글 목록 조회
router.get('/:postId/comments', asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const { page = 1, pageSize = 10 } = req.query;
    const offset = (page - 1) * pageSize;
  
    // 해당 그룹이 존재하지 않으면 에러
    const post = await prisma.post.findUnique({
      where: { postId },
    });
    if (!post) {
      return res.status(404).json({ message: '추억(포스트)을 찾을 수 없습니다.' });
    }
  
    // 정렬 기준 설정
    const orderBy = { createdAt: 'desc' };
  
    // 필터 조건 설정
    const where = {
        postId,
    };
  
    // 댓글 목록 조회
    const comments = await prisma.comment.findMany({
        where,
        orderBy,
        skip: parseInt(offset),
        take: parseInt(pageSize)
    });
  
    // 전체 댓글 수 조회
    const totalItems = await prisma.comment.count({ where });
  
    // 응답 데이터 구성
    const data = comments.map(comment => ({
        id: comment.commentId,
        nickname: comment.nickname,
        content: comment.content,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
    }));
  
    const response = {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / pageSize),
        totalItemCount: totalItems,
        data,
    };
  
    res.status(200).json(response);
  }));

export default router;
