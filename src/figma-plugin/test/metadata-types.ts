import type { MetadataInput } from '../src/model.ts';

// Compiled by the normal typecheck, never executed by the plugin.
export function checkAssignmentTypes(): void {
  const accept = (value: MetadataInput) => value;
  accept({kind:'button',key:'home.music',objectId:1,controlId:8101});
  accept({kind:'label',key:'home.title',objectId:2,controlId:null});
  accept({kind:'state',role:'normal',stateId:0,stateName:'Off'});
  // @ts-expect-error A button requires an addressable control ID.
  accept({kind:'button',key:'home.music',objectId:1});
  // @ts-expect-error A passive label cannot have a control ID.
  accept({kind:'label',key:'home.title',objectId:2,controlId:8101});
  // @ts-expect-error A page requires its panel profile and project name.
  accept({kind:'page',key:'page.home',objectId:100});
  // @ts-expect-error A state requires its role, ID and name.
  accept({kind:'state',stateName:'Off'});
  // @ts-expect-error An image requires its file and resource name.
  accept({kind:'image',key:'icon.music'});
}
