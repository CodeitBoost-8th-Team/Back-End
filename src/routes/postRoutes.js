import { Router } from 'express';

const postRouter = Router();

postRouter.get('/', (req, res) => {
    res.send('List of posts');
});


postRouter.post('/', (req, res) => {
    res.send('Create a new post');
});

export default postRouter;