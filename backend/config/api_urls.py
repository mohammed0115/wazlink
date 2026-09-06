"""/api/v1/ routing. The composition root routes composed endpoints to
analytics, and everything else to its owning domain."""

from django.urls import path

from apps.accounts.api.views import ChangePasswordView, RegisterView, VerifyEmailView
from apps.aiagent.api.views import (
    AgentProposalAcceptView,
    AgentProposalListCreateView,
    AgentProposalRejectView,
    AgentSessionCreateView,
)
from apps.analytics.api.views import (
    Customer360View,
    Lead360View,
    LeadTimelineView,
    RegisteredSectionsView,
)
from apps.assignment.api.views import AssignmentRuleDetailView, AssignmentRuleListCreateView
from apps.automation.api.views import (
    AutomationRuleDetailView,
    AutomationRuleListCreateView,
    AutomationRunApproveView,
    AutomationRunListView,
    AutomationRunRejectView,
)
from apps.crm.api.views import (
    AppointmentListCreateView,
    BusinessConvertView,
    ContactDetailView,
    ContactListView,
    LeadArchiveView,
    LeadContactsView,
    LeadCustomFieldSearchView,
    LeadCustomFieldsView,
    LeadListCreateView,
    LeadNoteView,
    LeadPriorityView,
    LeadStatusView,
    LeadTagView,
    TaskDetailView,
    TaskListCreateView,
)
from apps.customers.api.views import (
    CustomerArchiveView,
    CustomerContactsView,
    CustomerCustomFieldsView,
    CustomerListCreateView,
    CustomerUpdateView,
    LeadConvertView,
)
from apps.customfields.api.views import (
    FieldDefinitionArchiveView,
    FieldDefinitionListCreateView,
)
from apps.discovery.api.views import (
    BusinessDetailView,
    DiscoveryJobCancelView,
    DiscoveryJobDetailView,
    DiscoveryJobListCreateView,
    DiscoveryJobResultsView,
    DiscoveryJobRetryView,
    DiscoverySourceStatusView,
)
from apps.entitlements.api.views import EntitlementView
from apps.identity_access.api.views import (
    LoginView,
    LogoutView,
    SessionListView,
    SessionRevokeAllView,
    SessionRevokeView,
)
from apps.imports.api.views import (
    ImportCommitView,
    ImportDryRunView,
    ImportErrorsCsvView,
    ImportListCreateView,
    ImportMappingView,
)
from apps.intelligence.api.views import (
    AnalysisCancelView,
    AnalysisDetailView,
    AnalysisListCreateView,
    AnalysisReanalyzeView,
)
from apps.knowledge.api.views import (
    ArticleArchiveView,
    ArticleDetailView,
    ArticleListCreateView,
    ArticlePublishView,
)
from apps.messaging.api.views import (
    ConversationArchiveView,
    ConversationAssignView,
    ConversationDetailView,
    ConversationHandlingModeView,
    ConversationListView,
    ConversationReadView,
    ConversationReopenView,
    ConversationTakeoverView,
    MessageSendView,
    TemplateListView,
    TemplateMessageSendView,
)
from apps.pipeline.api.views import (
    DealCloseView,
    DealDetailView,
    DealListCreateView,
    DealStageView,
    PipelineListView,
)
from apps.workspaces.api.views import (
    InvitationAcceptView,
    InvitationCreateView,
    MemberListView,
    MembershipRoleView,
    WorkspaceListCreateView,
    WorkspaceSwitchView,
)

urlpatterns = [
    # --- I1: auth, workspaces, members ---
    path("auth/register", RegisterView.as_view()),
    path("auth/verify-email", VerifyEmailView.as_view()),
    path("auth/login", LoginView.as_view()),
    path("auth/logout", LogoutView.as_view()),
    path("auth/password/change", ChangePasswordView.as_view()),
    path("auth/sessions", SessionListView.as_view()),
    path("auth/sessions/revoke-all", SessionRevokeAllView.as_view()),
    path("auth/sessions/<str:session_ref>", SessionRevokeView.as_view()),
    path("workspaces", WorkspaceListCreateView.as_view()),
    path("workspaces/<str:workspace_ref>/switch", WorkspaceSwitchView.as_view()),
    path("workspaces/members", MemberListView.as_view()),
    path("invitations", InvitationCreateView.as_view()),
    path("invitations/accept", InvitationAcceptView.as_view()),
    path("memberships/<str:membership_ref>/role", MembershipRoleView.as_view()),
    path("entitlements", EntitlementView.as_view()),
    # --- I2: CRM. Lead 360 and the timeline are served by the COMPOSER. ---
    path("leads", LeadListCreateView.as_view()),
    path("leads/<str:lead_ref>", Lead360View.as_view()),
    path("leads/<str:lead_ref>/timeline", LeadTimelineView.as_view()),
    path("leads/<str:lead_ref>/status", LeadStatusView.as_view()),
    path("leads/<str:lead_ref>/priority", LeadPriorityView.as_view()),
    path("leads/<str:lead_ref>/archive", LeadArchiveView.as_view()),
    path("leads/<str:lead_ref>/tags", LeadTagView.as_view()),
    path("leads/<str:lead_ref>/contacts", LeadContactsView.as_view()),
    path("leads/<str:lead_ref>/notes", LeadNoteView.as_view()),
    path("leads/<str:lead_ref>/custom-fields", LeadCustomFieldsView.as_view()),
    path("leads/<str:lead_ref>/convert-customer", LeadConvertView.as_view()),
    path("contacts", ContactListView.as_view()),
    path("contacts/<str:contact_ref>", ContactDetailView.as_view()),
    path("tasks", TaskListCreateView.as_view()),
    path("tasks/<str:task_ref>", TaskDetailView.as_view()),
    path("appointments", AppointmentListCreateView.as_view()),
    # --- I5: customers, custom fields, imports ---
    path("customers", CustomerListCreateView.as_view()),
    path("customers/<str:customer_ref>", Customer360View.as_view()),
    path("customers/<str:customer_ref>/update", CustomerUpdateView.as_view()),
    path("customers/<str:customer_ref>/archive", CustomerArchiveView.as_view()),
    path("customers/<str:customer_ref>/contacts", CustomerContactsView.as_view()),
    path("customers/<str:customer_ref>/contacts/<str:contact_ref>", CustomerContactsView.as_view()),
    path("customers/<str:customer_ref>/custom-fields", CustomerCustomFieldsView.as_view()),
    path("custom-fields", FieldDefinitionListCreateView.as_view()),
    path("custom-fields/<str:field_ref>/archive", FieldDefinitionArchiveView.as_view()),
    path("leads/custom-fields/search", LeadCustomFieldSearchView.as_view()),
    path("imports", ImportListCreateView.as_view()),
    path("imports/<str:batch_ref>/mapping", ImportMappingView.as_view()),
    path("imports/<str:batch_ref>/dry-run", ImportDryRunView.as_view()),
    path("imports/<str:batch_ref>/commit", ImportCommitView.as_view()),
    path("imports/<str:batch_ref>/errors.csv", ImportErrorsCsvView.as_view()),
    # --- I3: discovery features ---
    path("discovery/jobs", DiscoveryJobListCreateView.as_view()),
    path("discovery/jobs/<str:job_ref>", DiscoveryJobDetailView.as_view()),
    path("discovery/jobs/<str:job_ref>/cancel", DiscoveryJobCancelView.as_view()),
    path("discovery/jobs/<str:job_ref>/retry", DiscoveryJobRetryView.as_view()),
    path("discovery/jobs/<str:job_ref>/results", DiscoveryJobResultsView.as_view()),
    path("discovery/sources", DiscoverySourceStatusView.as_view()),
    path("businesses/<str:business_ref>", BusinessDetailView.as_view()),
    path("businesses/<str:business_ref>/convert", BusinessConvertView.as_view()),
    # --- I4: AI lead intelligence ---
    path("intelligence/analyses", AnalysisListCreateView.as_view()),
    path("intelligence/analyses/<str:analysis_ref>", AnalysisDetailView.as_view()),
    path("intelligence/analyses/<str:analysis_ref>/reanalyze", AnalysisReanalyzeView.as_view()),
    path("intelligence/analyses/<str:analysis_ref>/cancel", AnalysisCancelView.as_view()),
    # --- I6: messaging, team inbox, assignment ---
    path("conversations", ConversationListView.as_view()),
    path("conversations/<str:conversation_ref>", ConversationDetailView.as_view()),
    path("conversations/<str:conversation_ref>/assign", ConversationAssignView.as_view()),
    path("conversations/<str:conversation_ref>/read", ConversationReadView.as_view()),
    path("conversations/<str:conversation_ref>/archive", ConversationArchiveView.as_view()),
    path("conversations/<str:conversation_ref>/reopen", ConversationReopenView.as_view()),
    path("conversations/<str:conversation_ref>/handling-mode", ConversationHandlingModeView.as_view()),
    path("conversations/<str:conversation_ref>/takeover", ConversationTakeoverView.as_view()),
    path("messages", MessageSendView.as_view()),
    path("messages/template", TemplateMessageSendView.as_view()),
    path("templates", TemplateListView.as_view()),
    path("assignment/rules", AssignmentRuleListCreateView.as_view()),
    path("assignment/rules/<str:rule_ref>", AssignmentRuleDetailView.as_view()),
    # --- I13: AI agent and knowledge base ---
    path("agent/sessions", AgentSessionCreateView.as_view()),
    path("agent/proposals", AgentProposalListCreateView.as_view()),
    path("agent/proposals/<str:proposal_ref>/accept", AgentProposalAcceptView.as_view()),
    path("agent/proposals/<str:proposal_ref>/reject", AgentProposalRejectView.as_view()),
    path("knowledge/articles", ArticleListCreateView.as_view()),
    path("knowledge/articles/<str:article_ref>", ArticleDetailView.as_view()),
    path("knowledge/articles/<str:article_ref>/publish", ArticlePublishView.as_view()),
    path("knowledge/articles/<str:article_ref>/archive", ArticleArchiveView.as_view()),
    # --- I8: automation ---
    path("automation/rules", AutomationRuleListCreateView.as_view()),
    path("automation/rules/<str:rule_ref>", AutomationRuleDetailView.as_view()),
    path("automation/runs", AutomationRunListView.as_view()),
    path("automation/runs/<str:run_ref>/approve", AutomationRunApproveView.as_view()),
    path("automation/runs/<str:run_ref>/reject", AutomationRunRejectView.as_view()),
    # --- I7: pipeline ---
    path("pipelines", PipelineListView.as_view()),
    path("deals", DealListCreateView.as_view()),
    path("deals/<str:deal_ref>", DealDetailView.as_view()),
    path("deals/<str:deal_ref>/stage", DealStageView.as_view()),
    path("deals/<str:deal_ref>/close", DealCloseView.as_view()),
    # --- diagnostics ---
    path("_composition", RegisteredSectionsView.as_view()),
]
