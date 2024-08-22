import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 댓글 수정
router.put('/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { nickname, content, commentPassword } = req.body;

    if (!nickname || !content || !commentPassword) {
      return res.status(400).json({ message: "잘못된 요청입니다" });
    }

    // 댓글 조회
    const comment = await prisma.comment.findUnique({
      where: { commentId },
    });
    // 댓글이 존재하지 않는 경우
    if (!comment) {
      return res.status(404).json({ message: '댓글이 존재하지 않습니다.' });
    }
    // 비밀번호 확인
    if (comment.commentPassword !== commentPassword) {
      return res.status(403).json({ message: '비밀번호가 틀렸습니다.' });
    }
    
    const updatedComment = await prisma.comment.update({
      where: { commentId },
      data: {
        nickname,
        content,
        commentPassword,
      },
    });

    res.status(200).json(updatedComment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});


// 댓글 삭제 API
router.delete('/:commentId', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { commentPassword } = req.body;

    if (!commentPassword) {
      return res.status(400).json({ message: "잘못된 요청입니다" });
    }

    // 댓글 조회
    const comment = await prisma.comment.findUnique({
      where: { commentId },
      select: { commentPassword: true },
    });
    if (!comment) {
      return res.status(404).json({ message: '댓글이 존재하지 않습니다.' });
    }
    if (comment.commentPassword !== commentPassword) {
      return res.status(401).json({ message: '비밀번호가 틀렸습니다.' });
    }

    // 댓글 삭제
    await prisma.comment.delete({
      where: { commentId },
    });
    
    res.status(200).json({ message: '댓글 삭제 성공' });    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '서버 에러가 발생했습니다.' });
  }
});

export default router;