import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

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
        keyword ? { name: { contains: keyword } } : {},
        isPublic !== undefined ? { isPublic: Boolean(isPublic) } : {},
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
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const group = await prisma.group.findUnique({
      where: { groupId: id },
    });

    if (group) {
      res.status(200).json(group);
    } else {
      res.status(404).json({ message: '그룹을 찾을 수 없습니다.' });
    }
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

    const updatedGroup = await prisma.group.update({
      where: { groupId },
      data: {
        name,
        groupPassword,
        imageUrl,
        isPublic: Boolean(isPublic),
        introduction,
        updatedAt: new Date(),
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

    await prisma.group.delete({
      where: { groupId },
    });

    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

// 그룹 조회 권한 확인
router.post('/:groupId/nonpublic', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { groupPassword } = req.body;

    const group = await prisma.group.findUnique({
      where: { groupId },
      select: { groupPassword: true },
    });

    if (group && group.groupPassword === groupPassword) {
      res.status(200).json({ message: '비밀번호가 일치합니다.' });
    } else if (!group) {
      res.status(404).json({ message: '그룹을 찾을 수 없습니다.' });
    } else {
      res.status(403).json({ message: '비밀번호가 틀렸습니다.' });
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

    await prisma.group.update({
      where: { groupId },
      data: { groupLikeCount: { increment: 1 } },
    });

    res.status(200).json({ message: '그룹에 공감했습니다.' });
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
      select: { isPublic: true },
    });

    if (group) {
      res.status(200).json({ isPublic: group.isPublic });
    } else {
      res.status(404).json({ message: '그룹을 찾을 수 없습니다.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

export default router;
