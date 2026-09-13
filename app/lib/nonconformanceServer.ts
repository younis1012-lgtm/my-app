import { createClient } from '@supabase/supabase-js';
import { canManageNonconformances } from './nonconformanceWorkflow';

const response = (error: string, status: number) => Response.json({success:false,error},{status});

export async function saveQualityAssuranceNonconformance(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey || !serviceKey) return response('שירות שמירת אי־התאמות אינו מוגדר',503);
    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return response('יש להתחבר לחשבון המערכת',401);
    const auth = createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const authResult = await auth.auth.getUser(token);
    const user = authResult.data.user;
    if (authResult.error || !user) return response('ההתחברות פגה. יש להתחבר שוב',401);
    const db = createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const body = await request.json().catch(()=>null);
    const projectId = String(body?.projectId || '').trim();
    const mode = body?.mode === 'update' ? 'update' : 'insert';
    const source = body?.record;
    if (!projectId || !source || typeof source !== 'object' || Array.isArray(source)) return response('בקשת השמירה אינה תקינה',400);
    const member = await db.from('project_members').select('role,active').eq('project_id',projectId).eq('user_id',user.id).maybeSingle();
    if (member.error || !member.data?.active) return response('אין הרשאה לפרויקט זה',403);
    const access = {
      username:String(user.app_metadata?.legacy_username || user.email || ''),
      displayName:String(user.user_metadata?.full_name || user.user_metadata?.name || ''),
      email:String(user.email || ''),
      role:String(member.data.role || ''),
    };
    if (!canManageNonconformances(access)) return response('אין הרשאה לפתוח או לסגור אי־התאמות',403);
    const id = String(source.id || '').trim();
    if (!id || String(source.project_id || '') !== projectId) return response('פרטי אי־ההתאמה אינם תקינים',400);
    if (mode === 'update') {
      const existing = await db.from('NCR').select('id,project_id').eq('id',id).maybeSingle();
      if (existing.error || String(existing.data?.project_id || '') !== projectId) return response('אי־ההתאמה לא נמצאה בפרויקט זה',404);
    }
    const record = {
      id,
      project_id:projectId,
      structure_node_id:source.structure_node_id || null,
      description:String(source.description || ''),
      action_required:String(source.action_required || ''),
      images:Array.isArray(source.images) ? source.images : [],
      approval:source.approval && typeof source.approval === 'object' ? source.approval : {},
      saved_at:source.saved_at || new Date().toISOString(),
      details:source.details && typeof source.details === 'object' ? source.details : {},
    };
    const result = mode === 'update'
      ? await db.from('NCR').update(record).eq('id',id).eq('project_id',projectId)
      : await db.from('NCR').insert(record);
    if (result.error) return response('שמירת אי־ההתאמה נכשלה',503);
    return Response.json({success:true});
  } catch {
    return response('שמירת אי־ההתאמה נכשלה',500);
  }
}
