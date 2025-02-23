import React from 'react';
import { BounceCards } from '../components/ui/bounce-cards';

interface RecentSearchProps {
  searches: any[];
  onSelectSearch: (searchId: string) => void;
  className?: string;
}

const transformStyles = [
  'rotate(10deg) translate(-170px)',
  'rotate(5deg) translate(-85px)',
  'rotate(-3deg)',
  'rotate(-10deg) translate(85px)',
  'rotate(2deg) translate(170px)',
];

export const RecentSearches: React.FC<RecentSearchProps> = ({
  searches,
  onSelectSearch,
  className,
}) => {
  if (!searches?.length) return null;

  const searchData = searches
    .slice(0, 5)
    .filter((search) => search.searchResults?.images?.[0]?.url)
    .map((search) => ({
      id: search._id,
      imageUrl: search.searchResults.images[0].url,
    }));

  // Calculate container width based on number of images
  // Each card is 120px wide plus their translations
  const containerWidth = Math.max(600, searchData.length * 170);

  const ClickWrapper: React.FC<{ children: React.ReactNode }> = ({
    children,
  }) => {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      const target = e.target as HTMLElement;
      const image = target.closest('img');
      if (image) {
        const imageUrl = image.getAttribute('src');
        const search = searchData.find((s) => s.imageUrl === imageUrl);
        if (search) {
          onSelectSearch(search.id);
        }
      }
    };

    return (
      <div
        onClick={handleClick}
        className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${className}`}
      >
        <div className="transform scale-150">{children}</div>
      </div>
    );
  };

  return (
    <ClickWrapper>
      <BounceCards
        images={searchData.map((s) => s.imageUrl)}
        containerWidth={containerWidth}
        containerHeight={150}
        animationDelay={0.5}
        animationStagger={0.06}
        easeType="elastic.out(1, 0.8)"
        transformStyles={transformStyles}
        className="flex justify-center items-end"
      />
    </ClickWrapper>
  );
};
