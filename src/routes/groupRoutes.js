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

export default router;
