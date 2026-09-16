import { type Request, type Response} from 'express';

const notFound = (req: Request, res: Response) => {
  // Only send response if headers haven't been sent yet
  if (!res.headersSent) {
    res.status(404).json({
      success: false,
      message: 'Not Found',
      error: ''
    });
  }
};

export default notFound;

