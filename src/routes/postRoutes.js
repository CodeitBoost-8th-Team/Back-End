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

export default router;
