import mongoose from 'mongoose';

const searchQuerySchema = new mongoose.Schema(
  {
    query: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['success', 'error'],
      default: 'success',
    },
    ipHash: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    sessionId: {
      type: String,
    },
    followUpMode: {
      type: String,
      enum: ['expansive', 'focused'],
    },
    concept: String,
    parentSearchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SearchQuery',
    },
    conversationHistory: [
      {
        query: String,
        nodeId: String,
        response: {
          response: String,
          followUpQuestions: [String],
          contextualQuery: String,
          sources: [
            {
              title: String,
              url: String,
              uri: String,
              author: String,
              image: String,
            },
          ],
          images: [
            {
              url: String,
              thumbnail: String,
              description: String,
            },
          ],
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    currentNodes: [
      {
        id: String,
        type: String,
        data: mongoose.Schema.Types.Mixed,
        position: {
          x: Number,
          y: Number,
        },
        style: mongoose.Schema.Types.Mixed,
      },
    ],
    currentEdges: [
      {
        id: String,
        source: String,
        target: String,
        type: String,
        style: mongoose.Schema.Types.Mixed,
      },
    ],
    searchResults: {
      response: String,
      followUpQuestions: [String],
      contextualQuery: String,
      sources: [
        {
          title: String,
          url: String,
          uri: String,
          author: String,
          image: String,
        },
      ],
      images: [
        {
          url: String,
          thumbnail: String,
          description: String,
        },
      ],
    },
    error: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

searchQuerySchema.index({ timestamp: -1 });
searchQuerySchema.index({ status: 1 });
searchQuerySchema.index({ ipHash: 1 });

export const SearchQuery =
  mongoose.models.SearchQuery ||
  mongoose.model('SearchQuery', searchQuerySchema);
