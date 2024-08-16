import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();
const prisma = new PrismaClient();

// 게시글 등록
router.post('/:groupId/posts', asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { nickname, title, content, postPassword, groupPassword, imageUrl, tags, location, moment, isPublicPost } = req.body;

    // 그룹 비밀번호 확인
    const group = await prisma.group.findUnique({
        where: { groupId },
    });

    if (!group) {
        return res.status(404).json({ message: '그룹을 찾을 수 없습니다.' });
    }

    if (group.groupPassword !== groupPassword) {
        return res.status(401).json({ message: '비밀번호가 틀렸습니다.' });
    }

    const newPost = await prisma.post.create({
        data: {
            groupId,
            nickname,
            title,
            content,
            postPassword,
            imageUrl,
            location,
            moment: moment ? new Date(moment) : null,
            isPublic: Boolean(isPublicPost),
            likeCount: 0,
            commentCount: 0,
            postTags: {
                create: tags.map(tag => ({
                    tag: {
                        connectOrCreate: {
                            where: { content: tag },
                            create: { content: tag },
                        }
                    }
                }))
            }
        },
        include: {
            postTags: true, // 태그 정보를 포함하여 반환
        }
    });

    res.status(201).json({
        id: newPost.postId,
        groupId: newPost.groupId,
        nickname: newPost.nickname,
        title: newPost.title,
        content: newPost.content,
        imageUrl: newPost.imageUrl,
        tags: newPost.postTags.map(pt => pt.tag.content),
        location: newPost.location,
        moment: newPost.moment,
        isPublic: newPost.isPublic,
        likeCount: newPost.likeCount,
        commentCount: newPost.commentCount,
        createdAt: newPost.createdAt,
        updatedAt: newPost.updatedAt,
    });
}));

// 게시글 목록 조회
router.get('/:groupId/posts', asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { page = 1, pageSize = 10, sortBy = 'latest', keyword = '', isPublic } = req.query;
    const offset = (page - 1) * pageSize;

    // 정렬 기준 설정
    let orderBy;
    switch (sortBy) {
        case 'mostCommented':
            orderBy = { commentCount: 'desc' };
            break;
        case 'mostLiked':
            orderBy = { likeCount: 'desc' };
            break;
        case 'latest':
        default:
            orderBy = { createdAt: 'desc' };
            break;
    }

    // 필터 조건 설정
    const where = {
        groupId,
        AND: [
            keyword ? {
                OR: [
                    { title: { contains: keyword } },
                    { content: { contains: keyword } },
                ]
            } : {},
            isPublic !== undefined ? { isPublic: isPublic === 'true' } : {},
        ],
    };

    // 게시글 목록 조회
    const posts = await prisma.post.findMany({
        where,
        orderBy,
        skip: parseInt(offset),
        take: parseInt(pageSize),
        include: {
            postTags: {
                include: {
                    tag: true,
                }
            }
        }
    });

    // 전체 게시글 수 조회
    const totalItems = await prisma.post.count({ where });

    // 태그 추출 및 응답 데이터 구성
    const data = posts.map(post => ({
        id: post.postId,
        nickname: post.nickname,
        title: post.title,
        imageUrl: post.imageUrl,
        tags: post.postTags.map(pt => pt.tag.content),
        location: post.location,
        moment: post.moment,
        isPublic: post.isPublic,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
    }));

    const response = {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / pageSize),
        totalItemCount: totalItems,
        data,
    };

    res.status(200).json(response);
}));

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

export default router;
