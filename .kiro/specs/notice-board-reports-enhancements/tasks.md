# Implementation Plan

- [x] 1. Add "New Report" button to Reports page header

  - Add button component to Reports page header section matching Notice Board design
  - Implement responsive behavior (hidden on mobile, visible on desktop)
  - Connect button to existing `handleOpenReportDialog` function
  - Ensure button connects to database submission handler for report creation
  - Test button functionality and styling consistency
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3_

- [ ] 2. Enhance FAB component to pass navigation state

  - Modify FloatingActionButton component to pass `openCreateForm: true` state when navigating
  - Update all three FAB actions (Notice, Report, Chat) to include navigation state
  - Test FAB navigation with state parameter
  - _Requirements: 2.1, 2.2, 2.3, 5.1_

- [ ] 3. Add navigation state handling to Reports page

  - Import useLocation hook in Reports component
  - Add useEffect to detect `openCreateForm` state and auto-open dialog
  - Clear navigation state after processing to prevent re-opening on refresh
  - Test FAB-to-Reports-form flow end-to-end
  - _Requirements: 2.3, 2.4, 5.2, 5.3_

- [ ] 4. Add navigation state handling to Notice Board page

  - Import useLocation hook in NoticeBoard component
  - Add useEffect to detect `openCreateForm` state and auto-open dialog
  - Clear navigation state after processing to prevent re-opening on refresh
  - Test FAB-to-Notice-form flow end-to-end
  - _Requirements: 2.2, 2.4, 5.2, 5.3_

- [ ] 5. Implement form validation improvements

  - Add proper field validation with specific error messages for both forms
  - Implement submit button disable state when required fields are empty
  - Add loading states during form submission
  - Test validation behavior and error display
  - _Requirements: 4.1, 4.2, 4.4, 4.5_

- [ ] 6. Add success feedback and list updates

  - Ensure new notices appear at top of list immediately after creation
  - Ensure new reports appear at top of list immediately after creation
  - Add success messages for successful form submissions
  - Verify database connectivity for both notice and report creation
  - Test immediate list updates and success feedback
  - _Requirements: 4.2, 4.3_

- [ ] 7. Test responsive behavior and mobile experience

  - Test "New Report" button visibility across different screen sizes
  - Verify FAB positioning doesn't interfere with bottom navigation on mobile
  - Test form dialogs on mobile devices for proper sizing and interaction
  - Validate touch interactions and mobile-specific behaviors
  - _Requirements: 1.4, 5.4_

- [ ] 8. Add comprehensive error handling

  - Implement error handling for navigation state processing failures
  - Add fallback behavior when forms fail to open via FAB navigation
  - Test error scenarios and ensure graceful degradation
  - Add proper error messages for form submission failures
  - _Requirements: 4.4, 5.5_

- [ ] 9. Create unit tests for new functionality

  - Write tests for "New Report" button presence and functionality
  - Write tests for FAB navigation state passing
  - Write tests for navigation state handling in both pages
  - Write tests for form validation improvements
  - Test responsive behavior and mobile-specific functionality

- [ ] 10. Ensure accurate database-driven statistics and counts

  - Verify all notice and report counts are fetched from database, not hardcoded
  - Implement real-time updates for view counts, like counts, and comment counts
  - Ensure statistics accurately reflect database state across all components
  - Test that stats update properly after new notices/reports are created
  - Validate that all displayed metrics match actual database values
  - _Requirements: 4.2, 4.3_

- [x] 11. Enhance flagged content display in admin dashboard


  - Improve ContentModeration component to clearly display reported content details
  - Add expandable content preview for flagged items showing full original content
  - Display report reasons and reporter information prominently
  - Add visual indicators for severity and report count per content item
  - Implement quick action buttons for common moderation decisions
  - Show content context (where it was posted, when, by whom)
  - Add filtering by report reason/category for easier content review
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 12. Perform integration testing and final validation
  - Test complete user flows: FAB → Navigation → Form Opening → Submission → Database
  - Verify consistency between Notice Board and Reports sections
  - Test all responsive breakpoints and device types
  - Validate accessibility features and keyboard navigation
  - Perform cross-browser compatibility testing
  - Verify end-to-end database connectivity for all create operations
