import { Prisma } from '@prisma/client';

function asyncHandler(handler) {
  return async function (req, res) {
    try {
      await handler(req, res);
    } catch (e) {
      if (
        e.name === 'StructError' || 
        e instanceof Prisma.PrismaClientValidationError
      ) {
        // 요청 양식 오류 처리
        res.status(400).send({ message: '잘못된 요청입니다.' });
      } else if (
        (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') ||
        e.message === 'NotFoundError'
      ) {
        // 리소스를 찾을 수 없는 경우 처리 (404)
        res.status(404).send({ message: '리소스를 찾을 수 없습니다.' });
      } /* else if (
        e.message === 'PostPasswordMismatch' || 
        e.message === 'GroupPasswordMismatch'
      ) {
        // 비밀번호 불일치 오류 처리 (401)
        res.status(401).send({ message: '비밀번호가 틀렸습니다.' });
      } */ else {
        // 기타 모든 오류 처리
        res.status(500).send({ message: '서버 오류가 발생했습니다.' });
      }
    }
  };
}

export default asyncHandler;