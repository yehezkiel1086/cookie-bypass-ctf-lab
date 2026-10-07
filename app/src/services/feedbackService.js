class FeedbackService {
  constructor() {
    this.feedbacks = [
      {
        id: 1,
        department: "SecOps",
        message: "Baseline routine security scan completed. No anomalies detected.",
        createdAt: new Date(Date.now() - 3600000).toISOString()
      }
    ];
  }

  addFeedback(department, message) {
    const item = {
      id: this.feedbacks.length + 1,
      department: department || "General",
      message: message,
      createdAt: new Date().toISOString()
    };
    this.feedbacks.push(item);
    return item;
  }

  getAll() {
    return this.feedbacks;
  }
}

export const feedbackService = new FeedbackService();
