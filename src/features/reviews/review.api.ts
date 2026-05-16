import api from "@/lib/axios";
import {
  createMockReview,
  getMockReviews,
  type MockReviewInput,
} from "@/services/mockDatabase";
import type { Review } from "@/types/review";

interface ReviewsResponse {
  success: boolean;
  data:
    | {
        data?: BackendReview[];
        reviews?: BackendReview[];
      }
    | BackendReview[];
}

interface ReviewResponse {
  success: boolean;
  data:
    | Review
    | {
        data?: BackendReview;
      };
}

interface BackendReview {
  _id?: string;
  id?: string;
  product?: string;
  productId?: string;
  user?:
    | string
    | {
        _id?: string;
        id?: string;
        name?: string;
      };
  userId?: string;
  userName?: string;
  rating: number;
  comment: string;
  createdAt?: string;
}

const toReview = (review: BackendReview): Review => {
  const user = review.user;

  return {
    id: review.id ?? review._id ?? `${review.productId}:${review.createdAt}`,
    productId: review.productId ?? review.product ?? "",
    userId:
      review.userId ??
      (typeof user === "string" ? user : user?._id ?? user?.id ?? ""),
    userName:
      review.userName ??
      (typeof user === "string" ? "Customer" : user?.name ?? "Customer"),
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt ?? new Date().toISOString(),
  };
};

const normalizeReviewList = (response: ReviewsResponse): Review[] => {
  const payload = response.data;
  const reviews = Array.isArray(payload)
    ? payload
    : payload.reviews ?? payload.data ?? [];

  return reviews.map(toReview);
};

const normalizeReview = (response: ReviewResponse): Review => {
  const payload = response.data;
  const review =
    "data" in payload && payload.data
      ? payload.data
      : (payload as BackendReview);

  return toReview(review);
};

export async function fetchProductReviews(productId: string): Promise<Review[]> {
  try {
    const response = await api.get<ReviewsResponse>(`/v1/reviews/${productId}`);
    return normalizeReviewList(response.data);
  } catch {
    return getMockReviews(productId);
  }
}

export async function submitProductReview(
  input: MockReviewInput
): Promise<Review> {
  if (!input.comment.trim()) {
    throw new Error("Review comment is required");
  }

  if (input.rating < 1 || input.rating > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  try {
    const response = await api.post<ReviewResponse>(
      "/v1/reviews",
      {
        productId: input.productId,
        rating: input.rating,
        comment: input.comment,
      }
    );
    return normalizeReview(response.data);
  } catch {
    return createMockReview(input);
  }
}
