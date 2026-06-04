import React from 'react';

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export const renderMessageContent = (content: string): React.ReactNode => {
  const parts = content.split(URL_REGEX);
  
  return parts.map((part, index) => {
    if (URL_REGEX.test(part)) {
      // Reset regex lastIndex after test
      URL_REGEX.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/70 break-all"
        >
          {part}
        </a>
      );
    }
    return part;
  });
};
