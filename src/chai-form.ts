/**
 * @license
 * Copyright 2024 Come Home AI, Inc.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { LitElement, html, css } from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import "./chai-name";
import "./chai-phone";
import "./chai-email";
import "./chai-address";
import "./chai-date";
import {ChaiFieldBase, ChaiFieldChangedDetails} from './ChaiFieldBase';
import {ApiEnvironment, api, extractFlowTypeFromHostname} from './ChaiApi';
import {publishGtmEvent} from './ChaiAnalytics';
import posthog from 'posthog-js';
import "./chai-stepper";

type FieldState = {
  value: unknown,
  valid: boolean
}

const GITHUB_SHA = '{{GITHUB_SHA}}';

/**
 * The quoting form element that initiates the flow for the user.
 */
@customElement('chai-form')
export class ChaiForm extends LitElement {
  @state() private formInstanceId = `FORM-${crypto.randomUUID()}`;

  @state() private overwrittenFlowType: string | null = null;

  @state() private gaMeasurementId: string | null = null;

  @state() private fieldStates: Map<string, FieldState>;

  constructor() {
    super();

    console.log("chai.js commit hash", GITHUB_SHA, this.formInstanceId);

    const visitorId = localStorage.getItem('chai-visitorId') || crypto.randomUUID();
    localStorage.setItem('chai-visitorId', visitorId);
    console.info("Visitor ID set", visitorId, this.formInstanceId);
    posthog.identify(visitorId);

    this.gaMeasurementId = localStorage.getItem('chai-gaMeasurementId');

    this.fieldStates = new Map<string, FieldState>();
    if (window.location.hostname.includes('correirabros.com')) {
      this.overwrittenFlowType = 'correirabros.com';
    }
    if (localStorage.getItem("chai-hotfix-version") === null || localStorage.getItem("chai-hotfix-version") === '1') {
      localStorage.removeItem('chai-flowInstanceId');
      localStorage.setItem('chai-hotfix-version', '2');
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    this.addEventListener('chai-fieldchanged', this.handleFieldChange);
  }

  static override styles = css`
    :host {
      /**
       * The form-level CSS properties provide the initial look and feel for the form.
       * Fine-grained adjustments are possible, but these form-level properties should
       * be sufficient for most use cases.
       */
      /**
       * The flex direction is set to column to stack the form fields vertically.
       * This can be changed to row to stack the form fields horizontally.
       */
      --chai-form-flex-direction: column;
      /**
       * The max width limits the width of the form component.
       * The layout is responsive and will adjust to the available space.
       */
      --chai-form-max-width: 400px;
      /**
       * The brand color is used to set the initial color for all text as well as the
       * background color for the button.
       */
      --chai-form-color-brand: #01919b;
      /**
       * The alert color is used to indicate errors or other important information.
       */
      --chai-form-color-alert: #fa2829;
      /**
       * The text color is used as the initial setting for all text elements, and
       * defaults to the brand color.
       */
      --chai-form-color-text: var(--chai-form-color-brand);
      /**
       * The background is used for the overall form background. Note this does not
       * have to be only a color.
       */
      --chai-form-background: #fffaf6;
      /**
       * The font family is applied to all of the form elements, except for inputs
       * which keep their system-assigned default sans-serif font.
       * By default, the font family is set to inherit from the parent element to
       * allow the form elements to blend into the surrounding website's brand.
       */
      --chai-form-font-family: inherit;
      /**
       * This font size is applied to all of the form elements.
       */
      --chai-form-font-size: 16px;
      /**
       * This font weight is applied to all of the form elements.
       */
      --chai-form-font-weight: 400;
      /**
       * This border is applied to the form element only.
       * Inputs and the button have their own border styles.
       */
      --chai-form-border: 1px solid #ccc;
      /**
       * This corner radius is applied to the form border, input field borders, and
       * the button by default.
       */
      --chai-form-corner-radius: 8px;
      /**
       * This spacing is applied to form padding as well as the vertical gap between
       * form fields. All other spacing is proportional to this value.
       */
      --chai-form-spacing: 16px;
      /**
       * Element-specific CSS properties allow for fine-tuning the look-and-feel.
       * These should only be changed after ensuring that the form-level properties
       * are insufficient for the desired look-and-feel.
       */
      --chai-header-font-size: calc(var(--chai-form-font-size) * 1.5);
      --chai-header-color: var(--chai-form-color-text);
      --chai-label-color: var(--chai-form-color-text);
      --chai-label-visibility: visible;
      --chai-label-height: auto;
      --chai-input-color: #000;
      --chai-input-corner-radius: calc(var(--chai-form-corner-radius) / 4);
      --chai-input-border: 0.8px solid rgb(233,228,224);
      --chai-input-shadow: rgba(21, 21, 21, 0.08) 0px 1px 2px 0px;
      --chai-button-color: #fff;
      --chai-button-font-size: var(--chai-form-font-size);
      --chai-button-text-transform: uppercase;
      --chai-button-background: var(--chai-form-color-brand);
      --chai-button-background-hover: var(--chai-form-color-brand);
      --chai-button-background-active: var(--chai-form-color-brand);
      /**
       * By default, the CHAI Form uses a CSS brightness filter to generate the
       * hover and active states for the button.
       * When specifying a background color for the hover and/or active states, it's
       * recommended to set the filter for the corresponding state to none.
       */
      --chai-button-filter-hover: brightness(1.2);
      --chai-button-filter-active: brightness(0.8);
      --chai-button-corner-radius: var(--chai-form-corner-radius);

      /**
       * The rest of this section defines the styles that are actually applied
       * to the custom element itself.
       */
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: var(--chai-form-max-width);
      font-family: var(--chai-form-font-family);
      font-size: var(--chai-form-font-size);
      font-weight: var(--chai-form-font-weight);
      text-shadow: none;
      text-align: left;
      border: var(--chai-form-border);
      border-radius: var(--chai-form-corner-radius);
      padding: var(--chai-form-spacing);
      background: var(--chai-form-background);
      color: var(--chai-form-color-brand);
    }
    h2 {
      color: var(--chai-header-color);
      font-size: var(--chai-header-font-size);
      margin-top: calc(var(--chai-form-spacing) / 4);
      margin-bottom: var(--chai-form-spacing);
    }
    form {
      display: flex;
      flex-direction: var(--chai-form-flex-direction);
      width: 100%;
      gap: calc(var(--chai-form-spacing) / 2);
    }
    label {
      font-size: calc(var(--chai-form-font-size) * 1.05);
      padding-left: 1px;
      color: var(--chai-label-color);
      margin-bottom: calc(-1 * var(--chai-form-spacing) / 4);
      visibility: var(--chai-label-visibility);
      height: var(--chai-label-height);

      span {
        color: var(--chai-form-color-alert);
        font-weight: bold;
      }
    }
    span.error {
      color: var(--chai-form-color-alert);
      font-size: calc(0.9 * var(--chai-form-font-size));
      margin-top: calc(-1 * var(--chai-form-spacing) / 4 * 3);
    }
    input {
      font-size: var(--chai-form-font-size);
      color: var(--chai-input-color);
      border: var(--chai-input-border);
      border-radius: var(--chai-input-corner-radius);
      box-shadow: var(--chai-input-shadow);
      padding: calc(var(--chai-form-spacing) / 2);
      margin-bottom: calc(var(--chai-form-spacing) / 2);

      &.invalid {
        border-color: var(--chai-form-color-alert);
        border-width: 2px;
      }
    }
    a {
      cursor: pointer;
      background: var(--chai-button-background);
      color: var(--chai-button-color);
      font-size: var(--chai-button-font-size);
      text-transform: var(--chai-button-text-transform);
      text-align: center;
      text-decoration: none;
      border-radius: var(--chai-button-corner-radius);
      margin-top: calc(var(--chai-form-spacing) * 1.5);
      margin-bottom: var(--chai-form-spacing);
      padding: calc(var(--chai-form-spacing) / 1.5);

      &:hover {
        background: var(--chai-button-background-hover);
        filter: var(--chai-button-filter-hover);
        &:active {
          background: var(--chai-button-background-hover);
          filter: var(--chai-button-filter-active);
        }
      }
      &:active {
        background: var(--chai-button-background-hover);
        filter: var(--chai-button-filter-active);
      }
    }
    slot[name="before"], slot[name="after"] {
      display: block;
      color: var(--chai-form-color-text);
    }
  `;

  /**
   * The environment to use for the API (defaults to production; only change this for
   * development purposes).
   */
  @property()
  accessor environment = ApiEnvironment.Production;

  /**
   * The ComeHome.ai flow type is the ID that has been configured for the location/context of
   * this form (e.g., the mover's website). If it is not provided we will attempt to infer it from the hostname.
   */
  @property()
  accessor flowType = extractFlowTypeFromHostname(window.location.hostname);

  /**
   * The text to display on the button; defaults to "Get Quote".
   */
  @property()
  accessor buttonText = "Get a Quote!";

  /**
   * The text to display in the header; defaults to "Get your moving quote now!".
   */
  @property()
  accessor headerText = "Get your moving quote now!";


  override connectedCallback() {
    super.connectedCallback();

    api(this.environment).formLoad(localStorage.getItem('chai-visitorId')!, this.flowType, localStorage.getItem('chai-flowInstanceId'));
  }

  override render() {
    return html`
      <h2>${this.headerText}</h2>
      <slot name="before"></slot>
      <form id="chai-quote-form">
        <slot>
          <chai-name></chai-name>
          <chai-phone></chai-phone>
          <chai-email></chai-email>
          <chai-address></chai-address>
        </slot>
        <a href="https://www.comehome.ai" @click="${this.submit}">${this.buttonText}</a>
      </form>
      <slot name="after">
        <chai-stepper></chai-stepper>
      </slot>
    `;
  }

  async initFlowIfNecessary() {
    if (localStorage.getItem('chai-flowInstanceId') != null) {
      return;
    }

    // If the flow has not loaded within 30 seconds we try again
    while (localStorage.getItem('chai-load-time-flow-instance') != null && localStorage.getItem('chai-load-time-flow-instance')! > String(Date.now() - 30_000)) {
      console.debug('Waiting for flow instance to load by different instance', this.formInstanceId);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // Initialize the flow instance if it hasn't been done yet.
    if (localStorage.getItem('chai-flowInstanceId') == null || this.gaMeasurementId == null) {
      localStorage.setItem('chai-load-time-flow-instance', String(Date.now()));
      const visitorId = localStorage.getItem('chai-visitorId')!;
      await api(this.environment).init(visitorId, this.overwrittenFlowType ?? this.flowType).then(formInit => {
        console.info('Flow initialized', formInit, visitorId, this.formInstanceId);
        localStorage.setItem('chai-flowInstanceId', formInit.flowInstanceId);
        this.gaMeasurementId = formInit.gaMeasurementId;
        localStorage.setItem('chai-gaMeasurementId', this.gaMeasurementId);
      });

    }
  }

  handleFieldChange(event: CustomEvent<ChaiFieldChangedDetails<unknown>>) {
    console.info("Field changed", event.detail, this.formInstanceId);

    const { field, value, valid } = event.detail;

    this.fieldStates.set(field, { value, valid });

    if (valid) {
      this.initFlowIfNecessary().then(() => {
        console.debug('flow instance loaded. Continue with fieldChange');
        //HACK: This works for an MSP, but returning visitors may end up with
        //      some data not directly associated with the current flow instance.
        //      That will primarily be an issue for the address, which is flow-specific.
        //      Our solution for this is to include all field values in the submit request.
        const storageFlowInstanceId = localStorage.getItem('chai-flowInstanceId');
        const visitorId = localStorage.getItem('chai-visitorId')!;
        if (storageFlowInstanceId != null) {
          console.info('Sending field update to API', field, value, visitorId, this.formInstanceId);
          api(this.environment).update(visitorId, storageFlowInstanceId, this.gaMeasurementId, field, value);
        } else {
          console.warn('Not sending field update to API; flow instance not initialized. Triggering new flowInit', field, value, visitorId, this.formInstanceId);
          this.initFlowIfNecessary();
        }
      });
    }

  }

  submit(e: Event) {
    e.preventDefault();
    const visitorId = localStorage.getItem('chai-visitorId')!;
    console.info("Submit requested", visitorId, this.formInstanceId);

    // At this point, we know the user has interacted with the form
    // so we can enforce display of any validation errors.
    const defaultSlot = this.renderRoot.querySelector<HTMLSlotElement>('slot:not([name])')!;
    const fieldElements = defaultSlot!.assignedElements({ flatten: true }).filter(element => element.tagName.startsWith("CHAI-"));
    const tagNamesToValidate: string[] = [];
    fieldElements.forEach(element => {
      (element as ChaiFieldBase<unknown>).forceValidation = true;
      tagNamesToValidate.push((element as ChaiFieldBase<unknown>).tagName);
    });

    const validatedTagNames: string[] = [];
    // Every field must have a valid value.
    for (const [fieldOfState, {valid}] of this.fieldStates.entries()) {
      const tagNameForFieldState = 'CHAI-' + fieldOfState.toUpperCase();
      const correspondingFieldInSlot = fieldElements.filter(element => element.tagName == tagNameForFieldState);
      if (correspondingFieldInSlot.length === 0) {
        console.trace('Ignoring validation of field not in slot', fieldOfState, visitorId, this.formInstanceId);
        continue;
      }
      validatedTagNames.push(tagNameForFieldState);
      if (!valid) {
        console.log('Invalid field', fieldOfState, this.formInstanceId);
        return;
      }
    }

    if (!tagNamesToValidate.every(tagName => validatedTagNames.includes(tagName))) {
      console.log('Not all fields validated', visitorId, this.formInstanceId);
      return;
    }

    console.info("Preparing submit", visitorId, this.formInstanceId);

    const fieldValues = Array.from(this.fieldStates.entries()).map(([key, value]) =>
      [key, value.value as string]);
    this.initFlowIfNecessary().then(() => {
      const flowInstanceId = localStorage.getItem('chai-flowInstanceId') || '';
      if (flowInstanceId == '') {
        console.error('Flow instance ID not found in local storage', visitorId, this.formInstanceId);
        posthog.capture('form_submit_error', {error: 'Flow instance ID not found in local storage', flow_type: this.flowType});
      }
      const submitUrl = api(this.environment).buildSubmitUrl(visitorId, this.overwrittenFlowType ?? this.flowType, flowInstanceId, fieldValues);

      publishGtmEvent('chai_form_submit', {flowType: this.overwrittenFlowType ?? this.flowType});
      posthog.capture('form_submitted', {flow_type: this.overwrittenFlowType ?? this.flowType, visitorId: visitorId});

      console.info('Initiating submit via navigation', submitUrl, visitorId, this.formInstanceId);

      window.open(submitUrl, '_blank');
    });
  }


}

declare global {
  interface HTMLElementTagNameMap {
    'chai-form': ChaiForm;
  }
}
