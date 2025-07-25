'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, X, Check, Edit2 } from 'lucide-react';

interface PdfSuggestion {
  servicePartName: string;
  songTitle: string;
  notes: string;
}

interface PdfProcessorProps {
  onSuggestionsAccepted: (suggestions: PdfSuggestion[]) => void;
  onClose: () => void;
  eventId?: string; // Optional eventId for saving document to event
  onSuggestionsAcceptedAndSaveDocument?: (suggestions: PdfSuggestion[], file: File) => void; // For new events
}

export default function PdfProcessor({ onSuggestionsAccepted, onClose, eventId, onSuggestionsAcceptedAndSaveDocument }: PdfProcessorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<PdfSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<PdfSuggestion>({
    servicePartName: '',
    songTitle: '',
    notes: ''
  });
  const [error, setError] = useState<string>('');
  const [savingDocument, setSavingDocument] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (!allowedTypes.includes(selectedFile.type)) {
        setError('Please select a PDF or Word document (.pdf, .doc, .docx)');
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be under 10MB');
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const processWithAI = async () => {
    if (!file) {
      setError('Please select a document first');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      // Create FormData to upload the document
      const formData = new FormData();
      formData.append('document', file);

      const response = await fetch('/api/process-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Processing failed');
      }

      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
        setShowSuggestions(true);
      } else {
        setError('No music information found in the document. Please add songs manually.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred processing the document');
    } finally {
      setProcessing(false);
    }
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditValues(suggestions[index]);
  };

  const saveEdit = () => {
    if (editingIndex !== null) {
      const newSuggestions = [...suggestions];
      newSuggestions[editingIndex] = editValues;
      setSuggestions(newSuggestions);
      setEditingIndex(null);
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
  };

  const removeSuggestion = (index: number) => {
    setSuggestions(suggestions.filter((_, i) => i !== index));
  };

  const acceptSuggestions = () => {
    onSuggestionsAccepted(suggestions);
    onClose();
  };

  const acceptSuggestionsAndAddDocument = async () => {
    if (!file) {
      setError('Missing document file');
      return;
    }

    setSavingDocument(true);
    setError('');

    try {
      if (eventId) {
        // Existing event - add suggestions and save document
        onSuggestionsAccepted(suggestions);

        // Then save the document to the event
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/events/${eventId}/documents`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save document');
        }
      } else if (onSuggestionsAcceptedAndSaveDocument) {
        // New event - trigger creation with document
        onSuggestionsAcceptedAndSaveDocument(suggestions, file);
      } else {
        throw new Error('Cannot save document: no event ID or creation callback provided');
      }

      // Success - close the modal
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document to event');
      setSavingDocument(false);
    }
  };

  if (showSuggestions) {
    return (
      <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Review Suggestions
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4 mb-6">
            {suggestions.map((suggestion, index) => (
              <div key={index} className="border rounded-lg p-4">
                {editingIndex === index ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Service Part
                      </label>
                      <input
                        type="text"
                        value={editValues.servicePartName}
                        onChange={(e) => setEditValues({
                          ...editValues,
                          servicePartName: e.target.value
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#660033]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Song Title
                      </label>
                      <input
                        type="text"
                        value={editValues.songTitle}
                        onChange={(e) => setEditValues({
                          ...editValues,
                          songTitle: e.target.value
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#660033]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <input
                        type="text"
                        value={editValues.notes}
                        onChange={(e) => setEditValues({
                          ...editValues,
                          notes: e.target.value
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#660033]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#660033]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <span className="text-sm font-medium text-gray-500">Service Part</span>
                          <div className="text-gray-900">{suggestion.servicePartName}</div>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500">Song Title</span>
                          <div className="text-gray-900">{suggestion.songTitle}</div>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-500">Notes</span>
                          <div className="text-gray-900">{suggestion.notes || 'None'}</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-4">
                      <button
                        onClick={() => startEditing(index)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <Edit2 className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => removeSuggestion(index)}
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={savingDocument}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#660033] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={acceptSuggestions}
              disabled={suggestions.length === 0 || savingDocument}
              className="px-4 py-2 text-sm font-medium text-white bg-[#660033] border border-transparent rounded-md hover:bg-[#800041] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#660033] disabled:opacity-50"
            >
              Accept
            </button>
            {(eventId || onSuggestionsAcceptedAndSaveDocument) && (
              <button
                onClick={acceptSuggestionsAndAddDocument}
                disabled={suggestions.length === 0 || savingDocument}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {savingDocument ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block" />
                    {eventId ? 'Saving...' : 'Creating Event...'}
                  </>
                ) : (
                  'Accept and Add Document to Event'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{backgroundColor: '#fdf2f8'}}>
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Auto Populate Service Parts
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="text-sm text-red-600">{error}</div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Service Bulletin (PDF or Word Document)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
                id="document-upload"
              />
              <label
                htmlFor="document-upload"
                className="cursor-pointer flex flex-col items-center space-y-2"
              >
                {file ? (
                  <>
                    <FileText className="w-8 h-8 text-gray-500" />
                    <div className="text-sm text-gray-600">{file.name}</div>
                    <div className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400" />
                    <div className="text-sm text-gray-600">
                      Click to upload document (PDF or Word, max 10MB)
                    </div>
                  </>
                )}
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#660033]"
            >
              Cancel
            </button>
            <button
              onClick={processWithAI}
              disabled={!file || processing}
              className="px-4 py-2 text-sm font-medium text-white bg-[#660033] border border-transparent rounded-md hover:bg-[#800041] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#660033] disabled:opacity-50"
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block" />
                  Analyzing document...
                </>
              ) : (
                'Auto Populate'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 