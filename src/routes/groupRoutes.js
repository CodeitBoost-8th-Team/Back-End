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

// 그룹 등록
router.post('/', async (req, res) => {
  try {
    const { name, groupPassword, imageUrl, isPublic, introduction } = req.body;

    const newGroup = await prisma.group.create({
      data: {
        name,
        groupPassword,
        imageUrl,
        isPublic: Boolean(isPublic),
        introduction,
        groupLikeCount: 0,
        postCount: 0,
      },
    });

    res.status(201).json(newGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

// 그룹 목록 조회
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, sortBy = 'latest', keyword = '', isPublic } = req.query;
    const offset = (page - 1) * pageSize;

    let orderBy;
    switch (sortBy) {
      case 'latest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'mostPosted':
        orderBy = { postCount: 'desc' };
        break;
      case 'mostLiked':
        orderBy = { groupLikeCount: 'desc' };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const where = {
      AND: [
        keyword ? {
          OR: [
            { name: { contains: keyword } },
            { introduction: { contains: keyword } }
          ]
        } : {},
        isPublic === 'true' || isPublic === 'false' ? { isPublic: isPublic === 'true' } : {},
      ],
    };

    const groups = await prisma.group.findMany({
      where,
      orderBy,
      skip: parseInt(offset),
      take: parseInt(pageSize),
    });

    const totalItems = await prisma.group.count({ where });

    const response = {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalItems / pageSize),
      totalItemCount: totalItems,
      data: groups,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

// 그룹 상세 정보 조회
router.get('/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    // 그룹 정보를 조회
    const group = await prisma.group.findUnique({
      where: { groupId },
    });

    // 그룹이 존재하는지 확인
    if (!group) {
      return res.status(404).json({ message: '그룹을 찾을 수 없습니다.' });
    }
    // 그룹이 비공개인 경우
    if (group.isPublic === false) {
      return res.status(403).json({ message: '비공개 그룹입니다!' });
    }
    // 그룹이 공개인 경우, 그룹 정보를 반환
    res.status(200).json(group);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

// 그룹 수정
router.put('/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, groupPassword, imageUrl, isPublic, introduction } = req.body;

    // 그룹 정보 조회
    const group = await prisma.group.findUnique({
      where: { groupId },
    });
    // 그룹이 존재하지 않는 경우
    if (!group) {
      return res.status(404).json({ message: '그룹을 찾을 수 없습니다.' });
    }
    // 비밀번호 확인
    if (group.groupPassword !== groupPassword) {
      return res.status(401).json({ message: '비밀번호가 틀렸습니다.' });
    }
    
    const updatedGroup = await prisma.group.update({
      where: { groupId },
      data: {
        name,
        groupPassword,
        imageUrl,
        isPublic: Boolean(isPublic),
        introduction,
      },
    });

    res.status(200).json(updatedGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

// 그룹 삭제
router.delete('/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { groupPassword } = req.body;

    // 그룹 조회
    const group = await prisma.group.findUnique({
      where: { groupId },
      select: { groupPassword: true },
    });
    if (!group) {
      return res.status(404).json({ message: '그룹을 찾을 수 없습니다.' });
    }
    if (group.groupPassword !== groupPassword) {
      return res.status(401).json({ message: '비밀번호가 틀렸습니다.' });
    }

    // 그룹 삭제
    await prisma.group.delete({
      where: { groupId },
    });
    
    res.status(200).json({ message: '그룹 삭제 성공' });    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

// 그룹 조회 권한 확인 및 비공개그룹 조회
router.post('/:groupId/private', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { groupPassword } = req.body;

    const group = await prisma.group.findUnique({
      where: { groupId },
    });

    if (!group) {
      res.status(404).json({ message: '그룹을 찾을 수 없습니다.' });
    } else if (group.groupPassword === groupPassword) {
      // 비공개 그룹의 상세 정보 반환
      res.status(200).json(group);
    } else {
      res.status(401).json({ message: '비밀번호가 틀렸습니다.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

// 그룹 공감하기
router.post('/:groupId/like', async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await prisma.group.findUnique({
      where: { groupId },
    });

    if (!group) {
      res.status(404).json({ message: '그룹을 찾을 수 없습니다.' });
    } else {
      await prisma.group.update({
        where: { groupId },
        data: { groupLikeCount: { increment: 1 } },
      });
  
      res.status(200).json({ message: '그룹에 공감했습니다.' });
    }    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

// 그룹 공개 여부 확인
router.get('/:groupId/is-public', async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await prisma.group.findUnique({
      where: { groupId },
      select: { groupId: true, isPublic: true },
    });

    if (group) {
      res.status(200).json({ groupId: group.groupId, isPublic: group.isPublic });
    } else {
      res.status(404).json({ message: '그룹을 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

// 게시글 등록
router.post('/:groupId/posts', asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { nickname, title, content, postPassword, groupPassword, imageUrl, tags = [], location, moment, isPublicPost } = req.body;

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

  const postTags = tags.length > 0 ? {
    create: tags.map(tag => ({
        tag: {
            connectOrCreate: {
                where: { content: tag },
                create: { content: tag },
            }
        }
    }))
} : undefined;

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
          postTags
      },
      include: {
        postTags: { include: { tag: true } }, // 태그 정보를 포함하여 반환!!
      },
  });

  res.status(201).json({
      id: newPost.postId,
      groupId: newPost.groupId,
      nickname: newPost.nickname,
      title: newPost.title,
      content: newPost.content,
      imageUrl: newPost.imageUrl,
      tags: newPost.postTags.map(pt => pt.tag ? pt.tag.content : null).filter(Boolean), // tag가 null이 아닌 경우에만 포함
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

export default router;
