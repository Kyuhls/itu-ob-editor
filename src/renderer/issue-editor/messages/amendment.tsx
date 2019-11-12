import React, { useContext } from 'react';

import { LangConfigContext } from 'sse/localizer/renderer';

import { AmendmentMessage } from 'models/messages/amendment';

import { FreeformContents } from '../freeform-contents';
import { MessageEditorProps } from '../message-editor';


export const MessageEditor: React.FC<MessageEditorProps> = function ({ message, onChange }) {
  const lang = useContext(LangConfigContext);
  const msg = message as AmendmentMessage;

  return (
    <FreeformContents
      doc={(msg.contents || {})[lang.default] || {}}
      onChange={(updatedDoc) => {
        onChange({ ...msg, contents: { ...msg.contents, [lang.default]: updatedDoc } });
      }}
    />
  );
};
